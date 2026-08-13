import { ArrowLeft, Home } from 'lucide-react';

export const metadata = { title: 'TenantIQ Checkout Canceled' };

export default function CheckoutCancelPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f5f7fa', fontFamily: 'Inter, Arial, sans-serif', display: 'grid', placeItems: 'center', padding: '32px' }}>
      <section style={{ width: 'min(660px,100%)', background: '#141b2b', border: '1px solid #26334a', borderRadius: 16, padding: 36, textAlign: 'center' }}>
        <div style={{ color: '#6aa7ff', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Stripe test checkout</div>
        <h1 style={{ margin: '0 0 14px', fontSize: 36, lineHeight: 1.1 }}>Checkout canceled.</h1>
        <p style={{ margin: '0 auto 24px', color: '#8b95a5', fontSize: 16, lineHeight: 1.7, maxWidth: 540 }}>No subscription was created. You can return to the pricing page and choose a plan whenever you are ready.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 8, background: '#4c8dff', color: '#07111f', textDecoration: 'none', fontWeight: 700 }}><ArrowLeft size={16}/> Return to pricing</a>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 8, border: '1px solid #3a4962', color: '#f5f7fa', textDecoration: 'none', fontWeight: 700 }}><Home size={16}/> TenantIQ home</a>
        </div>
      </section>
    </main>
  );
}
