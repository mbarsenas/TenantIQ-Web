import { CheckCircle2, ArrowRight, Home } from 'lucide-react';

export const metadata = { title: 'TenantIQ Checkout Complete' };

export default function CheckoutSuccessPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f5f7fa', fontFamily: 'Inter, Arial, sans-serif', display: 'grid', placeItems: 'center', padding: '32px' }}>
      <section style={{ width: 'min(680px,100%)', background: '#141b2b', border: '1px solid #26334a', borderRadius: 16, padding: 36, textAlign: 'center' }}>
        <CheckCircle2 size={52} color="#22c55e" style={{ margin: '0 auto 18px' }} />
        <div style={{ color: '#6aa7ff', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10 }}>Stripe test checkout</div>
        <h1 style={{ margin: '0 0 14px', fontSize: 36, lineHeight: 1.1 }}>Checkout completed.</h1>
        <p style={{ margin: '0 auto 24px', color: '#8b95a5', fontSize: 16, lineHeight: 1.7, maxWidth: 560 }}>The test subscription was created successfully. License fulfillment is the next stage of the TenantIQ commercial flow; no production license is issued from this test page yet.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 8, background: '#4c8dff', color: '#07111f', textDecoration: 'none', fontWeight: 700 }}>Back to pricing <ArrowRight size={16}/></a>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 8, border: '1px solid #3a4962', color: '#f5f7fa', textDecoration: 'none', fontWeight: 700 }}><Home size={16}/> TenantIQ home</a>
        </div>
      </section>
    </main>
  );
}
