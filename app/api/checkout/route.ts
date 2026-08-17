import { createHash, timingSafeEqual } from 'crypto';
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

const LAUNCH_TEST_TOKEN_SHA256 = '3e7cd6f1d21b532ecfcbc2f327bba898b019f267baac679ebb9694cc39775311';

function isAuthorizedLaunchTest(request: Request) {
  const urlToken = new URL(request.url).searchParams.get('launch_test')?.trim() || '';
  const token = request.headers.get('x-tenantiq-launch-test')?.trim() || urlToken;
  if (!token) return false;
  const actual = Buffer.from(createHash('sha256').update(token, 'utf8').digest('hex'), 'hex');
  const expected = Buffer.from(LAUNCH_TEST_TOKEN_SHA256, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function livePriceForEdition(edition: Edition) {
  const value = edition === 'Essentials'
    ? process.env.STRIPE_PRICE_ESSENTIALS
    : process.env.STRIPE_PRICE_PROFESSIONAL;
  const priceId = value?.trim() || '';
  return /^price_[A-Za-z0-9]+$/.test(priceId) ? priceId : '';
}

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

    const liveMode = /^(?:sk|rk)_live_/.test(secretKey);
    const checkoutGateValue = process.env.TENANTIQ_CHECKOUT_ENABLED ?? process.env.TENANTIQ_LIVE_CHECKOUT_ENABLED;
    const liveCheckoutEnabled = checkoutGateValue?.trim().toLowerCase() === 'true';
    const launchTestAuthorized = isAuthorizedLaunchTest(request);
    if (!liveCheckoutEnabled && !launchTestAuthorized) {
      console.warn('[TenantIQ checkout] Checkout request blocked by release gate.');
      return NextResponse.json(
        { error: 'TenantIQ live checkout is not available yet.' },
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
    params.set('automatic_tax[enabled]', 'true');
    params.set('integration_identifier', 'tenantiq_checkout_kqmdzvpa');

    if (liveMode) {
      const livePriceId = livePriceForEdition(edition);
      if (!livePriceId) {
        console.error(`[TenantIQ checkout] Live Stripe price is not configured for ${edition}.`);
        return NextResponse.json(
          { error: 'TenantIQ live pricing is not configured yet.' },
          { status: 503 },
        );
      }
      params.set('line_items[0][price]', livePriceId);
    } else {
      // Test mode intentionally uses inline prices so sandbox checkout remains isolated
      // from live product and price identifiers.
      params.set('line_items[0][price_data][currency]', 'usd');
      params.set('line_items[0][price_data][unit_amount]', String(plan.unitAmount));
      params.set('line_items[0][price_data][recurring][interval]', 'year');
      params.set('line_items[0][price_data][product_data][name]', plan.productName);
      params.set('line_items[0][price_data][product_data][description]', plan.description);
    }
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
    params.set('metadata[environment]', liveMode ? 'live' : 'test');
    if (launchTestAuthorized) {
      params.set('metadata[tenantiq_launch_test]', 'true');
      params.set('subscription_data[metadata][tenantiq_launch_test]', 'true');
    }

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
