import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOLERANCE_SECONDS = 300;
const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+$/;

function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(',').map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith('t='))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith('v1=')).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  const expectedBuffer = Buffer.from(expected, 'hex');

  return signatures.some((signature) => {
    try {
      const candidate = Buffer.from(signature, 'hex');
      return candidate.length === expectedBuffer.length && timingSafeEqual(candidate, expectedBuffer);
    } catch {
      return false;
    }
  });
}

async function stripeRequest(path: string, secretKey: string, params?: URLSearchParams) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: params?.toString(),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe API request failed (${response.status}).`);
  return data;
}

function maxTenantsForEdition(edition: string | null) {
  return edition === 'Professional' ? '5' : edition === 'Essentials' ? '1' : '0';
}

function getCheckoutTextField(session: any, key: string) {
  const fields = Array.isArray(session?.custom_fields) ? session.custom_fields : [];
  const field = fields.find((candidate: any) => candidate?.key === key);
  return typeof field?.text?.value === 'string' ? field.text.value.trim() : '';
}

function normalizeCustomerDomain(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\.$/, '');
  if (!normalized || normalized.includes('://') || normalized.includes('/') || normalized.includes('@')) return null;
  return DOMAIN_PATTERN.test(normalized) ? normalized : null;
}

async function dispatchFulfillment(subscriptionId: string) {
  const token = process.env.TENANTIQ_GITHUB_FULFILLMENT_TOKEN?.trim();
  if (!token) throw new Error('TENANTIQ_GITHUB_FULFILLMENT_TOKEN is not configured.');

  const repository = process.env.TENANTIQ_FULFILLMENT_REPOSITORY?.trim() || 'mbarsenas/TenantIQ';
  const workflow = process.env.TENANTIQ_FULFILLMENT_WORKFLOW?.trim() || 'fulfill-order.yml';
  const ref = process.env.TENANTIQ_FULFILLMENT_REF?.trim() || 'main';
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error('TENANTIQ_FULFILLMENT_REPOSITORY is invalid.');
  }

  const response = await fetch(
    `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10',
        'User-Agent': 'TenantIQ-Fulfillment',
      },
      body: JSON.stringify({
        ref,
        inputs: { subscription_id: subscriptionId },
      }),
      cache: 'no-store',
    },
  );

  if (response.status !== 204) {
    const body = await response.text();
    throw new Error(`GitHub fulfillment dispatch failed (${response.status}): ${body.slice(0, 500)}`);
  }
}

function metadataParams(values: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    params.set(`metadata[${key}]`, value);
  }
  return params;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!webhookSecret || !secretKey) {
    console.error('[TenantIQ webhook] Stripe secrets are not configured.');
    return NextResponse.json({ error: 'Webhook is not configured.' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });

  const payload = await request.text();
  if (!verifyStripeSignature(payload, signature, webhookSecret)) {
    console.error('[TenantIQ webhook] Invalid Stripe signature.');
    return NextResponse.json({ error: 'Invalid Stripe signature.' }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    try {
      const session = event.data?.object ?? {};
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
      const edition = session.metadata?.edition ?? null;
      const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
      const customerDomain = normalizeCustomerDomain(getCheckoutTextField(session, 'tenantdomain'));
      const maxTenants = maxTenantsForEdition(edition);

      if (!subscriptionId || !customerId || session.payment_status !== 'paid') {
        console.warn('[TenantIQ fulfillment] Checkout completed without paid subscription/customer identifiers.', session.id);
        return NextResponse.json({ received: true, fulfillment: 'skipped' });
      }

      const subscription = await stripeRequest(`subscriptions/${subscriptionId}`, secretKey);
      const existingMetadata = subscription?.metadata ?? {};
      const previousEventId = existingMetadata.tenantiq_fulfillment_event_id;
      const automationStatus = existingMetadata.tenantiq_automation_status;

      if (previousEventId === event.id && automationStatus === 'dispatched') {
        return NextResponse.json({ received: true, fulfillment: 'already_dispatched' });
      }

      if (previousEventId !== event.id) {
        const now = new Date().toISOString();
        const subscriptionParams = new URLSearchParams();
        subscriptionParams.set('metadata[tenantiq_product]', 'TenantIQ');
        subscriptionParams.set('metadata[tenantiq_edition]', edition || 'Unknown');
        subscriptionParams.set('metadata[tenantiq_max_tenants]', maxTenants);
        subscriptionParams.set('metadata[tenantiq_fulfillment_status]', customerDomain ? 'pending_license' : 'requires_domain_review');
        subscriptionParams.set('metadata[tenantiq_delivery_email_status]', 'pending');
        subscriptionParams.set('metadata[tenantiq_automation_status]', customerDomain ? 'pending_dispatch' : 'requires_domain_review');
        subscriptionParams.set('metadata[tenantiq_fulfillment_event_id]', event.id);
        subscriptionParams.set('metadata[tenantiq_checkout_session_id]', session.id || '');
        subscriptionParams.set('metadata[tenantiq_customer_email]', customerEmail || '');
        subscriptionParams.set('metadata[tenantiq_customer_domain]', customerDomain || '');
        subscriptionParams.set('metadata[tenantiq_payment_status]', session.payment_status || '');
        subscriptionParams.set('metadata[tenantiq_fulfillment_recorded_at]', now);
        await stripeRequest(`subscriptions/${subscriptionId}`, secretKey, subscriptionParams);

        const customerParams = new URLSearchParams();
        customerParams.set('metadata[tenantiq_customer]', 'true');
        customerParams.set('metadata[tenantiq_latest_edition]', edition || 'Unknown');
        customerParams.set('metadata[tenantiq_latest_subscription_id]', subscriptionId);
        customerParams.set('metadata[tenantiq_fulfillment_status]', customerDomain ? 'pending_license' : 'requires_domain_review');
        customerParams.set('metadata[tenantiq_fulfillment_event_id]', event.id);
        if (customerEmail) customerParams.set('metadata[tenantiq_email]', customerEmail);
        if (customerDomain) customerParams.set('metadata[tenantiq_customer_domain]', customerDomain);
        await stripeRequest(`customers/${customerId}`, secretKey, customerParams);
      }

      if (!customerDomain && previousEventId !== event.id) {
        console.error('[TenantIQ fulfillment] Paid checkout did not contain a valid Microsoft 365 domain.', session.id);
        return NextResponse.json({ received: true, fulfillment: 'requires_domain_review' });
      }

      const domainForDispatch = customerDomain || normalizeCustomerDomain(String(existingMetadata.tenantiq_customer_domain || ''));
      if (!domainForDispatch) {
        return NextResponse.json({ received: true, fulfillment: 'requires_domain_review' });
      }

      try {
        await dispatchFulfillment(subscriptionId);
      } catch (error) {
        await stripeRequest(
          `subscriptions/${subscriptionId}`,
          secretKey,
          metadataParams({
            tenantiq_automation_status: 'dispatch_failed',
            tenantiq_automation_failed_at: new Date().toISOString(),
          }),
        );
        throw error;
      }

      await stripeRequest(
        `subscriptions/${subscriptionId}`,
        secretKey,
        metadataParams({
          tenantiq_automation_status: 'dispatched',
          tenantiq_automation_dispatched_at: new Date().toISOString(),
        }),
      );

      const fulfillment = {
        eventId: event.id,
        checkoutSessionId: session.id ?? null,
        customerId,
        subscriptionId,
        customerEmail,
        customerDomain: domainForDispatch,
        edition,
        maxTenants: Number(maxTenants),
        paymentStatus: session.payment_status ?? null,
        amountTotal: session.amount_total ?? null,
        currency: session.currency ?? null,
        fulfillmentStatus: 'pending_license',
        automationStatus: 'dispatched',
        deliveryEmailStatus: 'pending',
      };
      console.log('[TenantIQ fulfillment dispatched]', JSON.stringify(fulfillment));
      return NextResponse.json({ received: true, fulfillment: 'dispatched' });
    } catch (error) {
      console.error('[TenantIQ fulfillment] Automation failed:', error);
      // Non-2xx makes Stripe retry the verified event. A duplicate dispatch is safe because
      // the fulfillment workflow serializes by subscription and exits when email is already sent.
      return NextResponse.json({ error: 'Fulfillment automation failed.' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true, fulfillment: 'not_applicable' });
}
