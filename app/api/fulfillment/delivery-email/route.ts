import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { sendTenantIQDeliveryEmail } from '../../../../lib/graph-mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function stripeGet(path: string, secretKey: string) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe API request failed (${response.status}).`);
  return data;
}

async function stripePost(path: string, secretKey: string, params: URLSearchParams) {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe API request failed (${response.status}).`);
  return data;
}

function validateClaimUrl(value: string) {
  const url = new URL(value);
  const allowedOrigin = new URL(process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://tenantiq365.com');
  if (url.protocol !== 'https:' || url.origin !== allowedOrigin.origin || url.pathname !== '/claim') {
    throw new Error('Claim URL must use the configured TenantIQ /claim endpoint.');
  }
  if (!url.searchParams.get('token')) throw new Error('Claim URL is missing its claim token.');
  return url.toString();
}

function metadataParams(values: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    params.set(`metadata[${key}]`, value);
  }
  return params;
}

export async function POST(request: Request) {
  const apiKey = process.env.TENANTIQ_FULFILLMENT_API_KEY?.trim();
  const stripeSecret = process.env.STRIPE_SECRET_KEY?.trim();
  if (!apiKey || !stripeSecret) {
    console.error('[TenantIQ delivery email] Fulfillment or Stripe configuration is missing.');
    return NextResponse.json({ error: 'Delivery email service is not configured.' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization') ?? '';
  const presentedKey = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!presentedKey || !secureEqual(presentedKey, apiKey)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { subscriptionId?: string; claimUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const subscriptionId = body.subscriptionId?.trim();
  if (!subscriptionId || !subscriptionId.startsWith('sub_')) {
    return NextResponse.json({ error: 'A valid Stripe subscription ID is required.' }, { status: 400 });
  }

  let claimUrl: string;
  try {
    claimUrl = validateClaimUrl(body.claimUrl?.trim() || '');
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid claim URL.' },
      { status: 400 },
    );
  }

  try {
    const subscription = await stripeGet(`subscriptions/${encodeURIComponent(subscriptionId)}`, stripeSecret);
    const metadata = subscription.metadata ?? {};

    if (!['active', 'trialing'].includes(subscription.status)) {
      return NextResponse.json({ error: 'TenantIQ subscription is not active.' }, { status: 409 });
    }
    if (metadata.tenantiq_fulfillment_status !== 'license_issued') {
      return NextResponse.json({ error: 'License issuance is not complete.' }, { status: 409 });
    }
    if (metadata.tenantiq_delivery_status !== 'download_ready') {
      return NextResponse.json({ error: 'Private R2 package is not ready.' }, { status: 409 });
    }
    if (metadata.tenantiq_storage_provider !== 'cloudflare_r2') {
      return NextResponse.json({ error: 'Private R2 delivery metadata is missing.' }, { status: 409 });
    }

    const email = String(metadata.tenantiq_customer_email || '').trim();
    const edition = String(metadata.tenantiq_edition || metadata.edition || 'TenantIQ').trim();
    const licenseId = String(metadata.tenantiq_license_id || '').trim();
    const claimExpiresAt = String(metadata.tenantiq_claim_expires_at || '').trim();

    if (!email || !email.includes('@') || !licenseId || !claimExpiresAt) {
      return NextResponse.json({ error: 'Fulfillment metadata is incomplete for email delivery.' }, { status: 409 });
    }

    const claimExpiry = new Date(claimExpiresAt);
    if (Number.isNaN(claimExpiry.getTime()) || claimExpiry.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Claim link is already expired.' }, { status: 409 });
    }

    const status = metadata.tenantiq_delivery_email_status;
    if (status === 'sent') {
      return NextResponse.json({ sent: true, status: 'already_sent' });
    }
    if (status === 'sending') {
      return NextResponse.json(
        { sent: false, status: 'send_in_progress', error: 'A previous delivery attempt is unresolved.' },
        { status: 409 },
      );
    }

    await stripePost(
      `subscriptions/${encodeURIComponent(subscriptionId)}`,
      stripeSecret,
      metadataParams({
        tenantiq_delivery_email_status: 'sending',
        tenantiq_delivery_email_attempted_at: new Date().toISOString(),
      }),
    );

    try {
      await sendTenantIQDeliveryEmail({
        to: email,
        edition,
        licenseId,
        claimUrl,
        claimExpiresAt,
      });
    } catch (error) {
      await stripePost(
        `subscriptions/${encodeURIComponent(subscriptionId)}`,
        stripeSecret,
        metadataParams({
          tenantiq_delivery_email_status: 'failed',
          tenantiq_delivery_email_failed_at: new Date().toISOString(),
        }),
      );
      throw error;
    }

    await stripePost(
      `subscriptions/${encodeURIComponent(subscriptionId)}`,
      stripeSecret,
      metadataParams({
        tenantiq_delivery_email_status: 'sent',
        tenantiq_delivery_email_sent_at: new Date().toISOString(),
      }),
    );

    console.log('[TenantIQ delivery email] Sent', { subscriptionId, licenseId });
    return NextResponse.json({ sent: true, status: 'sent' });
  } catch (error) {
    console.error('[TenantIQ delivery email] Failed:', error);
    return NextResponse.json({ error: 'Unable to send TenantIQ delivery email.' }, { status: 502 });
  }
}
