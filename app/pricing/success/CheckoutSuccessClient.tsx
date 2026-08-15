'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleEllipsis, Home, Loader2, UserRound } from 'lucide-react';

type Status = {
  paymentConfirmed: boolean;
  subscriptionActive: boolean;
  workspaceReady: boolean;
  fulfillmentStatus?: string | null;
  edition?: string | null;
  licensedDomain?: string | null;
  customerEmail?: string | null;
  licenseId?: string | null;
};

export default function CheckoutSuccessClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const sessionIdParam = new URLSearchParams(window.location.search).get('session_id')?.trim();
    if (!sessionIdParam) {
      setError('Checkout completed, but the Stripe session identifier is missing from this return URL.');
      setChecking(false);
      return;
    }

    // Copy the narrowed value so TypeScript knows the async callback always receives a string.
    const sessionId: string = sessionIdParam;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function check() {
      attempts += 1;
      try {
        const response = await fetch(`/api/checkout/status?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to verify checkout status.');
        if (cancelled) return;
        setStatus(data);
        setError('');
        if (!data.workspaceReady && attempts < 8) timer = setTimeout(check, 2500);
        else setChecking(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to verify checkout status.');
        if (attempts < 4) timer = setTimeout(check, 2500);
        else setChecking(false);
      }
    }

    check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);

  const ready = Boolean(status?.workspaceReady);

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f5f7fa', fontFamily: 'Inter, Arial, sans-serif', display: 'grid', placeItems: 'center', padding: 32 }}>
      <section style={{ width: 'min(720px,100%)', background: '#0b192b', border: '1px solid rgba(86,160,255,.22)', borderRadius: 16, padding: 36 }}>
        <div style={{ textAlign: 'center' }}>
          {ready ? <CheckCircle2 size={52} color="#22c55e" style={{ margin: '0 auto 18px' }} /> : checking ? <Loader2 size={48} color="#6aa7ff" style={{ margin: '0 auto 18px' }} /> : <CircleEllipsis size={48} color="#6aa7ff" style={{ margin: '0 auto 18px' }} />}
          <div style={{ color: '#6aa7ff', fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 10, fontWeight: 800 }}>TenantIQ subscription</div>
          <h1 style={{ margin: '0 0 14px', fontSize: 38, lineHeight: 1.1 }}>{ready ? 'Your TenantIQ workspace is ready.' : 'Checkout completed.'}</h1>
          <p style={{ margin: '0 auto 22px', color: '#a8b5c6', fontSize: 16, lineHeight: 1.7, maxWidth: 600 }}>{ready ? 'Payment, subscription, and TenantIQ fulfillment are confirmed. Sign in with the email used during checkout to access your licensed workspace.' : 'Your payment has returned successfully. TenantIQ is checking subscription and license fulfillment status now.'}</p>
        </div>

        {status && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, marginBottom: 22 }}>
          <StatusCard label="Payment" value={status.paymentConfirmed ? 'Confirmed' : 'Processing'} good={status.paymentConfirmed} />
          <StatusCard label="Subscription" value={status.subscriptionActive ? 'Active' : 'Processing'} good={status.subscriptionActive} />
          <StatusCard label="Workspace" value={status.workspaceReady ? 'Ready' : 'Fulfillment processing'} good={status.workspaceReady} />
          {status.edition && <StatusCard label="Edition" value={status.edition} />}
          {status.customerEmail && <StatusCard label="Purchase email" value={status.customerEmail} />}
          {status.licensedDomain && <StatusCard label="Licensed domain" value={status.licensedDomain} />}
        </div>}

        {checking && !ready && <div style={{ border: '1px solid rgba(86,160,255,.16)', borderRadius: 12, padding: 14, background: 'rgba(47,135,255,.05)', color: '#9fb1c5', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>TenantIQ is waiting for the Stripe webhook and license fulfillment workflow. This normally completes shortly; this page will refresh the status automatically.</div>}
        {error && <div style={{ border: '1px solid rgba(248,113,113,.25)', borderRadius: 12, padding: 14, background: 'rgba(248,113,113,.06)', color: '#fca5a5', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/signin" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 8, background: '#4c8dff', color: '#07111f', textDecoration: 'none', fontWeight: 800 }}><UserRound size={16}/> {ready ? 'Sign in to workspace' : 'Sign in to TenantIQ'} <ArrowRight size={16}/></a>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 8, border: '1px solid #3a4962', color: '#f5f7fa', textDecoration: 'none', fontWeight: 700 }}><Home size={16}/> TenantIQ home</a>
        </div>
      </section>
    </main>
  );
}

function StatusCard({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div style={{ border: '1px solid rgba(86,160,255,.14)', borderRadius: 10, padding: '12px 13px', background: 'rgba(4,14,27,.35)' }}><div style={{ color: '#7f8da2', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div><div style={{ color: good ? '#86efac' : '#e8eef7', fontSize: 14, fontWeight: 800, wordBreak: 'break-word' }}>{value}</div></div>;
}
