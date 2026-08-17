import { NextResponse } from 'next/server';
import { auth } from '../../../../auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isTenantIQSubscription(subscription: any) {
  const metadata = subscription?.metadata || {};
  return String(metadata.tenantiq_product || '').toLowerCase() === 'tenantiq' || Boolean(
    metadata.tenantiq_edition ||
    metadata.edition ||
    metadata.tenantiq_license_id ||
    metadata.tenantiq_checkout_session_id
  );
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
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe API request failed (${response.status}).`);
  }
  return payload;
}

function publicOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (configured || new URL(request.url).origin).replace(/\/$/, '');
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!session?.user?.id || !email) {
    return NextResponse.redirect(new URL('/signin', request.url), 303);
  }

  const expectedOrigin = publicOrigin(request);
  const requestOrigin = request.headers.get('origin')?.replace(/\/$/, '');
  if (requestOrigin && requestOrigin !== expectedOrigin) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.redirect(new URL('/account?error=portal', expectedOrigin), 303);
  }

  try {
    const customers = await stripeRequest(
      `customers?email=${encodeURIComponent(email)}&limit=100`,
      secretKey,
    );

    let customerId = '';
    for (const customer of Array.isArray(customers?.data) ? customers.data : []) {
      if (!customer?.id || String(customer.email || '').trim().toLowerCase() !== email) continue;
      const subscriptions = await stripeRequest(
        `subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=100`,
        secretKey,
      );
      if ((Array.isArray(subscriptions?.data) ? subscriptions.data : []).some(isTenantIQSubscription)) {
        customerId = customer.id;
        break;
      }
    }

    if (!customerId) {
      return NextResponse.redirect(new URL('/account?error=portal_customer', expectedOrigin), 303);
    }

    const params = new URLSearchParams();
    params.set('customer', customerId);
    params.set('return_url', `${expectedOrigin}/account`);
    const portal = await stripeRequest('billing_portal/sessions', secretKey, params);

    if (!portal?.url || !String(portal.url).startsWith('https://billing.stripe.com/')) {
      throw new Error('Stripe did not return a valid Customer Portal URL.');
    }

    return NextResponse.redirect(portal.url, 303);
  } catch (error) {
    console.error('[TenantIQ billing portal] Unable to create portal session:', {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.redirect(new URL('/account?error=portal', expectedOrigin), 303);
  }
}
