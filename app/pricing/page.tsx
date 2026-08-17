import PricingClient from './PricingClient';

export const dynamic = 'force-dynamic';

export default function PricingPage() {
  const checkoutGateValue = process.env.TENANTIQ_CHECKOUT_ENABLED ?? process.env.TENANTIQ_LIVE_CHECKOUT_ENABLED;
  const checkoutEnabled = checkoutGateValue?.trim().toLowerCase() === 'true';
  return <PricingClient checkoutEnabled={checkoutEnabled} />;
}
