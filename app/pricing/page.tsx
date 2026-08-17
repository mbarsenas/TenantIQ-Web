import PricingClient from './PricingClient';
import { TENANTIQ_PUBLIC_CHECKOUT_RELEASED } from '../../lib/tenantiq-checkout-release';

export const dynamic = 'force-dynamic';

export default function PricingPage() {
  return <PricingClient checkoutEnabled={TENANTIQ_PUBLIC_CHECKOUT_RELEASED} />;
}
