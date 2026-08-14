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

async function stripeGet(path: string, query: URLSearchParams) {
  const secret = stripeSecret();
  if (!secret) throw new Error('STRIPE_SECRET_KEY is not configured.');

  const url = new URL(`https://api.stripe.com/v1/${path}`);
  url.search = query.toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Stripe request failed (${response.status}).`);
  return payload;
}

function isUsableSubscription(subscription: any) {
  return ['active', 'trialing'].includes(String(subscription?.status || ''));
}

function isTenantIQSubscription(subscription: any) {
  const metadata = subscription?.metadata || {};
  return metadata.tenantiq_product === 'TenantIQ' || Boolean(metadata.tenantiq_edition || metadata.edition);
}

function isFulfilled(subscription: any) {
  const metadata = subscription?.metadata || {};
  // Current fulfillment marks issued customer packages as license_issued.
  // The explicit override exists only for controlled migrations/support cases.
  return metadata.tenantiq_fulfillment_status === 'license_issued' || metadata.tenantiq_workspace_access === 'enabled';
}

export async function getTenantIQEntitlement(email?: string | null): Promise<TenantIQEntitlement> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return { entitled: false, reason: 'not_authenticated' };

  if (!stripeSecret()) {
    if (process.env.NODE_ENV !== 'production') return { entitled: true, reason: 'active', edition: 'Development' };
    return { entitled: false, reason: 'stripe_unavailable' };
  }

  try {
    const customerQuery = new URLSearchParams({ email: normalizedEmail, limit: '100' });
    const customersPayload = await stripeGet('customers', customerQuery);
    const customers = Array.isArray(customersPayload?.data) ? customersPayload.data : [];

    if (customers.length === 0) return { entitled: false, reason: 'no_purchase' };

    let sawTenantIQ = false;
    let sawUsable = false;

    for (const customer of customers) {
      if (!customer?.id) continue;
      const subscriptionQuery = new URLSearchParams({ customer: customer.id, status: 'all', limit: '100' });
      const subscriptionsPayload = await stripeGet('subscriptions', subscriptionQuery);
      const subscriptions = Array.isArray(subscriptionsPayload?.data) ? subscriptionsPayload.data : [];

      for (const subscription of subscriptions) {
        if (!isTenantIQSubscription(subscription)) continue;
        sawTenantIQ = true;
        if (!isUsableSubscription(subscription)) continue;
        sawUsable = true;
        if (!isFulfilled(subscription)) continue;

        const metadata = subscription.metadata || {};
        return {
          entitled: true,
          reason: 'active',
          edition: metadata.tenantiq_edition || metadata.edition || 'TenantIQ',
          subscriptionId: subscription.id,
          status: subscription.status,
        };
      }
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
  if (!session?.user?.id) return { session: null, entitlement: { entitled: false, reason: 'not_authenticated' } as TenantIQEntitlement };
  const entitlement = await getTenantIQEntitlement(session.user.email);
  return { session, entitlement };
}
