'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, LockKeyhole, ShieldCheck, XCircle } from 'lucide-react';

type ClaimResult = {
  valid: boolean;
  deliveryId?: string | null;
  edition?: string | null;
  licenseId?: string | null;
  domain?: string | null;
  maxTenants?: number;
  expiresAt?: string | null;
  claimExpiresAt?: string | null;
  customerEmail?: string | null;
  downloadAvailable?: boolean;
  downloadUrl?: string | null;
  downloadExpiresAt?: string | null;
  deliverySha256?: string | null;
  message?: string;
};

export default function ClaimPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claim, setClaim] = useState<ClaimResult | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')?.trim();
    if (!token) {
      setError('This claim link is missing its secure token.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const response = await fetch('/api/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to validate this claim.');
        setClaim(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to validate this claim.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="claim-page">
      <style jsx global>{`
        *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#07111f}body{font-family:Inter,Arial,sans-serif;color:#f5f7fa}.claim-page{min-height:100vh;display:grid;place-items:center;padding:32px;background:radial-gradient(circle at 50% 0%,rgba(76,141,255,.15),transparent 34%),linear-gradient(180deg,#07111f 0%,#0d1321 100%)}.claim-card{width:min(720px,100%);border:1px solid #26334a;border-radius:18px;background:rgba(20,27,43,.96);padding:34px;box-shadow:0 24px 70px rgba(0,0,0,.26)}.claim-brand{font:700 24px 'Space Grotesk',Inter,sans-serif;margin-bottom:28px}.claim-state{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:30px 8px}.claim-state h1{margin:4px 0 0;font:700 clamp(30px,5vw,42px)/1.08 'Space Grotesk',Inter,sans-serif}.claim-state p{max-width:560px;margin:0;color:#9aa8bd;line-height:1.7}.claim-kicker{color:#6aa7ff;font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase}.claim-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:28px}.claim-item{border:1px solid #26334a;border-radius:12px;padding:15px;background:#101827}.claim-item span{display:block;color:#7f8da2;font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px}.claim-item strong{font-size:14px;word-break:break-word}.claim-notice{margin-top:22px;padding:15px;border:1px solid rgba(106,167,255,.28);background:rgba(76,141,255,.08);border-radius:12px;color:#b7c9e6;font-size:14px;line-height:1.6}.claim-hash{margin-top:12px;color:#738198;font:12px 'IBM Plex Mono',monospace;word-break:break-all}.claim-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin-top:24px}.claim-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border-radius:9px;border:1px solid #3a4962;text-decoration:none;color:#fff;font-weight:700}.claim-button.primary{background:#4c8dff;border-color:#4c8dff;color:#07111f}.claim-button.download{background:#31d17c;border-color:#31d17c;color:#07111f}.error{color:#fecaca}@media(max-width:640px){.claim-grid{grid-template-columns:1fr}.claim-card{padding:22px}.claim-page{padding:18px}}
      `}</style>
      <section className="claim-card">
        <div className="claim-brand">TenantIQ</div>
        {loading && <div className="claim-state"><Loader2 size={44}/><div className="claim-kicker">Secure customer delivery</div><h1>Validating your claim…</h1><p>TenantIQ is verifying the signed fulfillment record and claim token.</p></div>}
        {!loading && error && <div className="claim-state"><XCircle size={48}/><div className="claim-kicker">Claim validation failed</div><h1>We couldn't verify this link.</h1><p className="error">{error}</p><div className="claim-actions"><a className="claim-button" href="/">TenantIQ home</a></div></div>}
        {!loading && claim && <>
          <div className="claim-state"><CheckCircle2 size={52} color="#31d17c"/><div className="claim-kicker">Secure customer delivery</div><h1>Your TenantIQ package is verified.</h1><p>{claim.message}</p></div>
          <div className="claim-grid">
            <div className="claim-item"><span>Edition</span><strong>{claim.edition || 'TenantIQ'}</strong></div>
            <div className="claim-item"><span>Licensed tenants</span><strong>{claim.maxTenants || '—'}</strong></div>
            <div className="claim-item"><span>License ID</span><strong>{claim.licenseId || '—'}</strong></div>
            <div className="claim-item"><span>Licensed domain</span><strong>{claim.domain || '—'}</strong></div>
            <div className="claim-item"><span>Delivery ID</span><strong>{claim.deliveryId || '—'}</strong></div>
            <div className="claim-item"><span>Customer</span><strong>{claim.customerEmail || 'Verified customer'}</strong></div>
          </div>
          <div className="claim-notice"><ShieldCheck size={18} style={{verticalAlign:'middle',marginRight:8}}/>The claim token, subscription, license, and private package record have been validated. {claim.downloadAvailable ? 'Your download URL is short-lived and grants read-only access to this customer package only.' : 'Private storage publishing is not complete yet.'}{claim.deliverySha256 && <div className="claim-hash">SHA256: {claim.deliverySha256}</div>}</div>
          <div className="claim-actions">
            {claim.downloadAvailable && claim.downloadUrl && <a className="claim-button download" href={claim.downloadUrl}><Download size={17}/> Download TenantIQ</a>}
            <a className="claim-button primary" href="/pricing"><LockKeyhole size={16}/> TenantIQ pricing</a>
            <a className="claim-button" href="/">TenantIQ home</a>
          </div>
        </>}
      </section>
    </main>
  );
}
