import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PLANS = {
  Essentials: {
    unitAmount: 49900,
    productName: 'TenantIQ Essentials',
    description: 'TenantIQ Essentials annual subscription for 1 Microsoft 365 tenant.',
  },
  Professional: {
    unitAmount: 99900,
    productName: 'TenantIQ Professional',
    description: 'TenantIQ Professional annual subscription for up to 5 Microsoft 365 tenants.',
  },
} as const;

type Edition = keyof typeof PLANS;

function getPublicOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
  if (forwardedHost && !forwardedHost.startsWith('localhost') && !forwardedHost.startsWith('127.0.0.1')) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get('host')?.trim();
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return `https://${host}`;
  }

  return 'https://tenantiq365.com';
}

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe test checkout is not configured on this deployment yet.' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const edition = String(body?.edition || '') as Edition;
    const plan = PLANS[edition];

    if (!plan) {
      return NextResponse.json({ error: 'Invalid TenantIQ edition.' }, { status: 400 });
    }

    const origin = getPublicOrigin(request);
    const params = new URLSearchParams();
    params.set('mode', 'subscription');

    // Build the recurring Stripe Price inline. This avoids stale or cross-sandbox
    // hard-coded price IDs while keeping the annual TenantIQ pricing authoritative here.
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', String(plan.unitAmount));
    params.set('line_items[0][price_data][recurring][interval]', 'year');
    params.set('line_items[0][price_data][product_data][name]', plan.productName);
    params.set('line_items[0][price_data][product_data][description]', plan.description);
    params.set('line_items[0][quantity]', '1');

    params.set('success_url', `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`);
    params.set('cancel_url', `${origin}/pricing/cancel`);
    params.set('allow_promotion_codes', 'true');
    params.set('billing_address_collection', 'auto');

    // Fulfillment requires the Microsoft 365 tenant domain before a signed license can be issued.
    params.set('custom_fields[0][key]', 'tenantdomain');
    params.set('custom_fields[0][label][type]', 'custom');
    params.set('custom_fields[0][label][custom]', 'Microsoft 365 primary domain');
    params.set('custom_fields[0][type]', 'text');
    params.set('custom_fields[0][optional]', 'false');
    params.set('custom_fields[0][text][minimum_length]', '4');
    params.set('custom_fields[0][text][maximum_length]', '253');
    params.set(
      'custom_text[submit][message]',
      'Enter the primary Microsoft 365 domain that TenantIQ will be licensed to, for example contoso.com.',
    );

    params.set('subscription_data[metadata][product]', 'TenantIQ');
    params.set('subscription_data[metadata][edition]', edition);
    params.set('metadata[product]', 'TenantIQ');
    params.set('metadata[edition]', edition);
    params.set('metadata[environment]', secretKey.startsWith('sk_live_') ? 'live' : 'test');

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      cache: 'no-store',
    });

    const session = await stripeResponse.json();

    if (!stripeResponse.ok || !session?.url) {
      const stripeMessage = session?.error?.message || 'Unable to create Stripe Checkout session.';
      const stripeCode = session?.error?.code || session?.error?.type || 'stripe_error';
      console.error('[TenantIQ checkout] Stripe error:', {
        status: stripeResponse.status,
        code: stripeCode,
        message: stripeMessage,
        requestId: stripeResponse.headers.get('request-id'),
      });
      return NextResponse.json(
        { error: stripeMessage, code: stripeCode },
        { status: stripeResponse.status >= 400 && stripeResponse.status < 500 ? 400 : 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[TenantIQ checkout] route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to start checkout.' },
      { status: 500 },
    );
  }
}
