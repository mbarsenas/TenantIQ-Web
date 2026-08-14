import { auth } from '../auth';

export type TenantIQEntitlement = {
  entitled: boolean;
  reason: 'active' | 'not_authenticated' | 'no_purchase' | 'inactive' | 'not_fulfilled' | 'stripe_unavailable';
  edition?: string;
  subscriptionId?: string;
  status?: string;
};

function stripeSecret() {
  return process.env.STRIPE_SECRET_KEY?.trim() || '';
}

async function stripeGet(path: string, query?: URLSearchParams) {
  const secret = stripeSecret();
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured.');
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  if (query) url.search = query.toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Stripe request failed (${response.status}).`);
  return payload;
}

async function stripeGetOptional(path: string, query?: URLSearchParams) {
  try {
    return await stripeGet(path, query);
  } catch (error) {
    console.warn(`[TenantIQ entitlement] Optional Stripe lookup failed for ${path}:`, error);
    return null;
  }
}

function isUsableSubscription(subscription: any) {
  return ['active', 'trialing'].includes(String(subscription?.status || '').toLowerCase());
}

function isTenantIQSubscription(subscription: any) {
  const metadata = subscription?.metadata || {};
  return String(metadata.tenantiq_product || '').toLowerCase() === 'tenantiq' || Boolean(
    metadata.tenantiq_edition || metadata.edition || metadata.tenantiq_license_id || metadata.tenantiq_checkout_session_id
  );
}

function isFulfilled(subscription: any) {
  const metadata = subscription?.metadata || {};
  return metadata.tenantiq_fulfillment_status === 'license_issued' ||
    metadata.tenantiq_workspace_access === 'enabled' ||
    metadata.tenantiq_delivery_status === 'download_ready' ||
    Boolean(metadata.tenantiq_license_id && metadata.tenantiq_license_issued_at);
}

function entitlementFromSubscription(subscription: any): TenantIQEntitlement | null {
  if (!isTenantIQSubscription(subscription) || !isUsableSubscription(subscription) || !isFulfilled(subscription)) return null;
  const metadata = subscription.metadata || {};
  return {
    entitled: true,
    reason: 'active',
    edition: metadata.tenantiq_edition || metadata.edition || 'TenantIQ',
    subscriptionId: subscription.id,
    status: subscription.status,
  };
}

async function subscriptionsForCustomer(customerId: string) {
  const query = new URLSearchParams({ customer: customerId, status: 'all', limit: '100' });
  const payload = await stripeGet('subscriptions', query);
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function customersForEmail(email: string) {
  const customersById = new Map<string, any>();
  const directPayload = await stripeGet('customers', new URLSearchParams({ email, limit: '100' }));
  for (const customer of Array.isArray(directPayload?.data) ? directPayload.data : []) {
    if (customer?.id) customersById.set(customer.id, customer);
  }

  const metadataQuery = new URLSearchParams();
  metadataQuery.set('query', `metadata['tenantiq_email']:'${email.replace(/'/g, "\\'")}'`);
  metadataQuery.set('limit', '100');
  const metadataPayload = await stripeGetOptional('customers/search', metadataQuery);
  for (const customer of Array.isArray(metadataPayload?.data) ? metadataPayload.data : []) {
    if (customer?.id) customersById.set(customer.id, customer);
  }
  return [...customersById.values()];
}

async function subscriptionsForPurchaseEmail(email: string) {
  const query = new URLSearchParams();
  query.set('query', `metadata['tenantiq_customer_email']:'${email.replace(/'/g, "\\'")}'`);
  query.set('limit', '100');
  const payload = await stripeGetOptional('subscriptions/search', query);
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function getTenantIQEntitlement(email?: string | null): Promise<TenantIQEntitlement> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return { entitled: false, reason: 'not_authenticated' };
  if (!stripeSecret()) {
    if (process.env.NODE_ENV !== 'production') return { entitled: true, reason: 'active', edition: 'Development' };
    return { entitled: false, reason: 'stripe_unavailable' };
  }

  try {
    const subscriptionsById = new Map<string, any>();
    const customers = await customersForEmail(normalizedEmail);

    for (const customer of customers) {
      if (!customer?.id) continue;
      for (const subscription of await subscriptionsForCustomer(customer.id)) {
        if (subscription?.id) subscriptionsById.set(subscription.id, subscription);
      }

      const latestSubscriptionId = String(customer?.metadata?.tenantiq_latest_subscription_id || '').trim();
      if (latestSubscriptionId && !subscriptionsById.has(latestSubscriptionId)) {
        const latest = await stripeGetOptional(`subscriptions/${encodeURIComponent(latestSubscriptionId)}`);
        if (latest?.id) subscriptionsById.set(latest.id, latest);
      }
    }

    for (const subscription of await subscriptionsForPurchaseEmail(normalizedEmail)) {
      if (subscription?.id) subscriptionsById.set(subscription.id, subscription);
    }

    const subscriptions = [...subscriptionsById.values()];
    if (!subscriptions.length) return { entitled: false, reason: 'no_purchase' };

    let sawTenantIQ = false;
    let sawUsable = false;
    for (const subscription of subscriptions) {
      if (!isTenantIQSubscription(subscription)) continue;
      sawTenantIQ = true;
      if (!isUsableSubscription(subscription)) continue;
      sawUsable = true;
      const entitlement = entitlementFromSubscription(subscription);
      if (entitlement) return entitlement;
    }

    if (!sawTenantIQ) return { entitled: false, reason: 'no_purchase' };
    if (!sawUsable) return { entitled: false, reason: 'inactive' };
    return { entitled: false, reason: 'not_fulfilled' };
  } catch (error) {
    console.error('[TenantIQ entitlement] Stripe entitlement lookup failed:', error);
    return { entitled: false, reason: 'stripe_unavailable' };
  }
}

export async function requireTenantIQEntitlement() {
  const session = await auth();
  if (!session?.user?.id) {
    return { session: null, entitlement: { entitled: false, reason: 'not_authenticated' } as TenantIQEntitlement };
  }
  const entitlement = await getTenantIQEntitlement(session.user.email);
  return { session, entitlement };
}
