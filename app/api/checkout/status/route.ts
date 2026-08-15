import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function maskEmail(email: string | null | undefined) {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

function safeId(value: unknown, prefix: string) {
  const id = String(value || '').trim();
  return id.startsWith(prefix) && /^[A-Za-z0-9_]+$/.test(id) ? id : '';
}

async function stripeGet(path: string, secretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `Stripe request failed (${response.status}).`);
  return payload;
}

export async function GET(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return NextResponse.json({ error: 'Checkout status is not configured.' }, { status: 503 });

  const sessionId = safeId(new URL(request.url).searchParams.get('session_id'), 'cs_');
  if (!sessionId) return NextResponse.json({ error: 'A valid checkout session is required.' }, { status: 400 });

  try {
    const session = await stripeGet(`checkout/sessions/${encodeURIComponent(sessionId)}`, secretKey);
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const subscription = subscriptionId ? await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`, secretKey) : null;
    const metadata = subscription?.metadata || {};
    const paymentConfirmed = session.payment_status === 'paid' || session.status === 'complete';
    const subscriptionActive = ['active', 'trialing'].includes(String(subscription?.status || '').toLowerCase());
    const workspaceReady = subscriptionActive && (
      metadata.tenantiq_fulfillment_status === 'license_issued' ||
      metadata.tenantiq_workspace_access === 'enabled' ||
      metadata.tenantiq_delivery_status === 'download_ready' ||
      Boolean(metadata.tenantiq_license_id && metadata.tenantiq_license_issued_at)
    );

    return NextResponse.json({
      sessionId,
      paymentConfirmed,
      subscriptionActive,
      workspaceReady,
      fulfillmentStatus: metadata.tenantiq_fulfillment_status || metadata.tenantiq_delivery_status || (paymentConfirmed ? 'processing' : 'pending_payment'),
      edition: metadata.tenantiq_edition || metadata.edition || session.metadata?.edition || null,
      licensedDomain: metadata.tenantiq_license_domain || metadata.tenantiq_customer_domain || null,
      customerEmail: maskEmail(metadata.tenantiq_customer_email || session.customer_details?.email || session.customer_email || null),
      licenseId: metadata.tenantiq_license_id || null,
    });
  } catch (error) {
    console.error('[TenantIQ checkout status] Lookup failed:', error);
    return NextResponse.json({ error: 'Unable to verify checkout status right now.' }, { status: 502 });
  }
}
