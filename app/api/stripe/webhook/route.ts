import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOLERANCE_SECONDS = 300;

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

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    console.error('[TenantIQ webhook] STRIPE_WEBHOOK_SECRET is not configured.');
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
    const session = event.data?.object ?? {};
    const fulfillment = {
      eventId: event.id,
      eventType: event.type,
      livemode: Boolean(event.livemode),
      checkoutSessionId: session.id ?? null,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null,
      customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
      paymentStatus: session.payment_status ?? null,
      status: session.status ?? null,
      product: session.metadata?.product ?? null,
      edition: session.metadata?.edition ?? null,
      environment: session.metadata?.environment ?? null,
      amountTotal: session.amount_total ?? null,
      currency: session.currency ?? null,
      receivedAt: new Date().toISOString(),
    };

    // GoDaddy's application filesystem is not a durable fulfillment database.
    // Log the verified record for sandbox validation. The next stage will persist
    // this object in a durable store before production license issuance is enabled.
    console.log('[TenantIQ fulfillment]', JSON.stringify(fulfillment));
  }

  return NextResponse.json({ received: true });
}
