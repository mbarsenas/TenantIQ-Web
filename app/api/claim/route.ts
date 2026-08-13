import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function maskEmail(email: string | null | undefined) {
  if (!email || !email.includes('@')) return null;
  const [local, domain] = email.split('@');
  const visible = local.length <= 2 ? local[0] ?? '*' : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

async function stripeGet(path: string, secretKey: string, query?: URLSearchParams) {
  const url = new URL(`https://api.stripe.com/v1/${path}`);
  if (query) url.search = query.toString();

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secretKey}` },
    cache: 'no-store',
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || `Stripe API request failed (${response.status}).`);
  }
  return data;
}

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json({ error: 'Claim service is not configured.' }, { status: 503 });
  }

  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token || token.length < 20 || token.length > 256) {
    return NextResponse.json({ error: 'Invalid claim token.' }, { status: 400 });
  }

  const tokenHash = sha256(token);
  const search = new URLSearchParams();
  search.set('query', `metadata['tenantiq_claim_token_sha256']:'${tokenHash}'`);
  search.set('limit', '2');

  try {
    const result = await stripeGet('subscriptions/search', secretKey, search);
    const matches = Array.isArray(result?.data) ? result.data : [];

    if (matches.length !== 1) {
      return NextResponse.json({ error: 'Claim link is invalid or no longer active.' }, { status: 404 });
    }

    const subscription = matches[0];
    const metadata = subscription.metadata ?? {};
    const expiryRaw = metadata.tenantiq_claim_expires_at;
    const expiry = expiryRaw ? new Date(expiryRaw) : null;

    if (subscription.status !== 'active') {
      return NextResponse.json({ error: 'The related TenantIQ subscription is not active.' }, { status: 403 });
    }
    if (metadata.tenantiq_fulfillment_status !== 'license_issued') {
      return NextResponse.json({ error: 'License issuance is not complete.' }, { status: 409 });
    }
    if (metadata.tenantiq_delivery_status !== 'package_ready') {
      return NextResponse.json({ error: 'The customer package is not ready.' }, { status: 409 });
    }
    if (!expiry || Number.isNaN(expiry.getTime()) || expiry.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'This claim link has expired.' }, { status: 410 });
    }

    return NextResponse.json({
      valid: true,
      deliveryId: metadata.tenantiq_delivery_id ?? null,
      edition: metadata.tenantiq_edition ?? metadata.edition ?? null,
      licenseId: metadata.tenantiq_license_id ?? null,
      domain: metadata.tenantiq_license_domain ?? null,
      maxTenants: Number(metadata.tenantiq_max_tenants ?? 0),
      expiresAt: metadata.tenantiq_license_expires_at ?? null,
      claimExpiresAt: expiry.toISOString(),
      customerEmail: maskEmail(metadata.tenantiq_customer_email ?? null),
      downloadAvailable: false,
      message: 'Your TenantIQ package is verified and ready. Secure download hosting is the final delivery step.',
    });
  } catch (error) {
    console.error('[TenantIQ claim] Validation failed:', error);
    return NextResponse.json({ error: 'Unable to validate this claim right now.' }, { status: 502 });
  }
}
