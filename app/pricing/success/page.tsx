import { CheckCircle2, ArrowRight, Home, UserRound } from 'lucide-react';

export const metadata = { title: 'TenantIQ Checkout Complete' };

export default function CheckoutSuccessPage() {
  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f5f7fa', fontFamily: 'Inter, Arial, sans-serif', display: 'grid', placeItems: 'center', padding: '32px' }}>
      <section style={{ width: 'min(700px,100%)', background: '#0b192b', border: '1px solid rgba(86,160,255,.22)', borderRadius: 16, padding: 36, textAlign: 'center' }}>
        <CheckCircle2 size={52} color="#22c55e" style={{ margin: '0 auto 18px' }} />
        <div style={{ color: '#6aa7ff', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 800 }}>TenantIQ subscription</div>
        <h1 style={{ margin: '0 0 14px', fontSize: 38, lineHeight: 1.1 }}>Checkout completed.</h1>
        <p style={{ margin: '0 auto 18px', color: '#a8b5c6', fontSize: 16, lineHeight: 1.7, maxWidth: 590 }}>Your TenantIQ subscription was submitted successfully. TenantIQ fulfillment associates the purchase with the Microsoft 365 domain entered during checkout and prepares workspace access for the purchase email.</p>
        <div style={{ margin: '0 auto 26px', maxWidth: 590, border: '1px solid rgba(86,160,255,.16)', borderRadius: 12, padding: 14, background: 'rgba(47,135,255,.05)', color: '#9fb1c5', fontSize: 13, lineHeight: 1.6 }}>Sign in with the same email address used for checkout. If fulfillment is still processing, your account may briefly show that a license is required before access becomes active.</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signin" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 8, background: '#4c8dff', color: '#07111f', textDecoration: 'none', fontWeight: 800 }}><UserRound size={16}/> Sign in to TenantIQ <ArrowRight size={16}/></a>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 8, border: '1px solid #3a4962', color: '#f5f7fa', textDecoration: 'none', fontWeight: 700 }}><Home size={16}/> TenantIQ home</a>
        </div>
      </section>
    </main>
  );
}
