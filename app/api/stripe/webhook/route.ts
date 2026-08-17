import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { TENANTIQ_PUBLIC_CHECKOUT_RELEASED } from '../../../../lib/tenantiq-checkout-release';

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

async function dispatchFulfillmentWorkflow(subscriptionId: string) {
  const token = process.env.TENANTIQ_GITHUB_TOKEN?.trim();
  const repository = process.env.TENANTIQ_FULFILLMENT_REPOSITORY?.trim() || 'mbarsenas/TenantIQ';
  const workflow = process.env.TENANTIQ_FULFILLMENT_WORKFLOW?.trim() || 'fulfill-order.yml';
  const ref = process.env.TENANTIQ_FULFILLMENT_REF?.trim() || 'main';

  if (!token) {
    throw new Error('TENANTIQ_GITHUB_TOKEN is not configured on the TenantIQ web host.');
  }

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
        'User-Agent': 'TenantIQ-Web-Fulfillment',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref,
        inputs: {
          subscription_id: subscriptionId,
        },
      }),
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub fulfillment dispatch failed (${response.status}): ${detail.slice(0, 500)}`);
  }
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

async function markDispatchComplete(subscriptionId: string, customerId: string | null, secretKey: string) {
  const dispatchedAt = new Date().toISOString();

  const subscriptionParams = new URLSearchParams();
  subscriptionParams.set('metadata[tenantiq_fulfillment_dispatch_status]', 'dispatched');
  subscriptionParams.set('metadata[tenantiq_fulfillment_dispatched_at]', dispatchedAt);
  await stripeRequest(`subscriptions/${subscriptionId}`, secretKey, subscriptionParams);

  if (customerId) {
    const customerParams = new URLSearchParams();
    customerParams.set('metadata[tenantiq_fulfillment_dispatch_status]', 'dispatched');
    customerParams.set('metadata[tenantiq_fulfillment_dispatched_at]', dispatchedAt);
    await stripeRequest(`customers/${customerId}`, secretKey, customerParams);
  }
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

  const liveCheckoutEnabled = TENANTIQ_PUBLIC_CHECKOUT_RELEASED;
  const launchTestEvent = event?.data?.object?.metadata?.tenantiq_launch_test === 'true';
  if (event?.livemode === true && !liveCheckoutEnabled && !launchTestEvent) {
    console.warn('[TenantIQ webhook] Live Stripe event blocked by release gate.', event?.id, event?.type);
    return NextResponse.json({ error: 'TenantIQ live fulfillment is not enabled.' }, { status: 503 });
  }

  if (event.type === 'checkout.session.completed') {
    let diagnosticStage = 'checkout_session_parse';

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

      diagnosticStage = 'stripe_subscription_lookup';
      const subscription = await stripeRequest(`subscriptions/${subscriptionId}`, secretKey);
      const previousEventId = subscription?.metadata?.tenantiq_fulfillment_event_id;
      const dispatchStatus = subscription?.metadata?.tenantiq_fulfillment_dispatch_status;
      const existingDomain = normalizeCustomerDomain(String(subscription?.metadata?.tenantiq_customer_domain || ''));
      const domainForFulfillment = customerDomain || existingDomain;

      if (previousEventId === event.id && dispatchStatus === 'dispatched') {
        return NextResponse.json({ received: true, fulfillment: 'already_dispatched' });
      }

      if (!domainForFulfillment) {
        const reviewParams = new URLSearchParams();
        reviewParams.set('metadata[tenantiq_fulfillment_status]', 'requires_domain_review');
        reviewParams.set('metadata[tenantiq_fulfillment_dispatch_status]', 'requires_domain_review');
        reviewParams.set('metadata[tenantiq_fulfillment_event_id]', event.id);
        reviewParams.set('metadata[tenantiq_checkout_session_id]', session.id || '');
        reviewParams.set('metadata[tenantiq_customer_email]', customerEmail || '');
        reviewParams.set('metadata[tenantiq_payment_status]', session.payment_status || '');

        diagnosticStage = 'stripe_subscription_domain_review_metadata';
        await stripeRequest(`subscriptions/${subscriptionId}`, secretKey, reviewParams);

        console.error('[TenantIQ fulfillment] Paid checkout did not contain a valid Microsoft 365 domain.', session.id);
        return NextResponse.json({ received: true, fulfillment: 'requires_domain_review' });
      }

      if (previousEventId !== event.id || !existingDomain) {
        const subscriptionParams = new URLSearchParams();
        subscriptionParams.set('metadata[tenantiq_product]', 'TenantIQ');
        subscriptionParams.set('metadata[tenantiq_edition]', edition || 'Unknown');
        subscriptionParams.set('metadata[tenantiq_max_tenants]', maxTenants);
        subscriptionParams.set('metadata[tenantiq_customer_domain]', domainForFulfillment);
        subscriptionParams.set('metadata[tenantiq_fulfillment_status]', 'pending_license');
        subscriptionParams.set('metadata[tenantiq_delivery_email_status]', 'pending');
        subscriptionParams.set('metadata[tenantiq_fulfillment_dispatch_status]', 'pending');
        subscriptionParams.set('metadata[tenantiq_fulfillment_event_id]', event.id);
        subscriptionParams.set('metadata[tenantiq_checkout_session_id]', session.id || '');
        subscriptionParams.set('metadata[tenantiq_customer_email]', customerEmail || '');
        subscriptionParams.set('metadata[tenantiq_payment_status]', session.payment_status || '');
        subscriptionParams.set('metadata[tenantiq_fulfillment_recorded_at]', new Date().toISOString());

        diagnosticStage = 'stripe_subscription_metadata';
        await stripeRequest(`subscriptions/${subscriptionId}`, secretKey, subscriptionParams);

        const customerParams = new URLSearchParams();
        customerParams.set('metadata[tenantiq_customer]', 'true');
        customerParams.set('metadata[tenantiq_latest_edition]', edition || 'Unknown');
        customerParams.set('metadata[tenantiq_latest_subscription_id]', subscriptionId);
        customerParams.set('metadata[tenantiq_customer_domain]', domainForFulfillment);
        customerParams.set('metadata[tenantiq_fulfillment_status]', 'pending_license');
        customerParams.set('metadata[tenantiq_fulfillment_dispatch_status]', 'pending');
        customerParams.set('metadata[tenantiq_fulfillment_event_id]', event.id);
        if (customerEmail) customerParams.set('metadata[tenantiq_email]', customerEmail);

        diagnosticStage = 'stripe_customer_metadata';
        await stripeRequest(`customers/${customerId}`, secretKey, customerParams);
      }

      diagnosticStage = 'github_fulfillment_dispatch';
      await dispatchFulfillmentWorkflow(subscriptionId);

      diagnosticStage = 'stripe_dispatch_status_update';
      await markDispatchComplete(subscriptionId, customerId, secretKey);

      const fulfillment = {
        eventId: event.id,
        checkoutSessionId: session.id ?? null,
        customerId,
        subscriptionId,
        customerEmail,
        customerDomain: domainForFulfillment,
        edition,
        maxTenants: Number(maxTenants),
        paymentStatus: session.payment_status ?? null,
        amountTotal: session.amount_total ?? null,
        currency: session.currency ?? null,
        fulfillmentStatus: 'pending_license',
        fulfillmentDispatchStatus: 'dispatched',
        deliveryEmailStatus: 'pending',
      };
      console.log('[TenantIQ fulfillment dispatched]', JSON.stringify(fulfillment));
      return NextResponse.json({ received: true, fulfillment: 'dispatched' });
    } catch (error) {
      console.error('[TenantIQ fulfillment] Persistence/dispatch failed:', {
        stage: diagnosticStage,
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        {
          error: 'Fulfillment persistence or dispatch failed.',
          stage: diagnosticStage,
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ received: true, fulfillment: 'not_applicable' });
}
