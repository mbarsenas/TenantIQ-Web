import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const PRICE_IDS = {
  Essentials: 'price_1U3or32YGBL7nUyuQOFEOPNk',
  Professional: 'price_1U3orF2YGBL7nUyu6snxDV4B',
} as const;

type Edition = keyof typeof PRICE_IDS;

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
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe test checkout is not configured on this deployment yet.' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const edition = String(body?.edition || '') as Edition;
    const price = PRICE_IDS[edition];

    if (!price) {
      return NextResponse.json({ error: 'Invalid TenantIQ edition.' }, { status: 400 });
    }

    const origin = getPublicOrigin(request);
    const params = new URLSearchParams();
    params.set('mode', 'subscription');
    params.set('line_items[0][price]', price);
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
    params.set('metadata[environment]', 'test');

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
      console.error('[TenantIQ checkout] Stripe error:', session);
      return NextResponse.json(
        { error: session?.error?.message || 'Unable to create Stripe Checkout session.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('[TenantIQ checkout] route error:', error);
    return NextResponse.json({ error: 'Unable to start checkout.' }, { status: 500 });
  }
}
