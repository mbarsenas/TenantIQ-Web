'use client';

import { useState } from 'react';
import { ArrowLeft, Check, Loader2, Lock, ShieldCheck } from 'lucide-react';

type Edition = 'Essentials' | 'Professional';

const plans = [
  {
    edition: 'Essentials' as Edition,
    price: '$499', cadence: '/ year', tenantLabel: '1 Microsoft 365 tenant',
    description: 'For internal IT teams that need a repeatable Microsoft 365 posture assessment for one tenant.',
    features: ['416 registered controls', '8 Microsoft 365 workloads', 'Read-only assessment workflow', 'Workload assessment exports', 'Executive Portfolio Report', 'Product updates while subscribed'],
  },
  {
    edition: 'Professional' as Edition,
    price: '$999', cadence: '/ year', tenantLabel: 'Up to 5 Microsoft 365 tenants',
    description: 'For consultants, MSP engineers, and organizations running repeatable assessments across multiple tenants.',
    features: ['Everything in Essentials', 'Up to 5 licensed tenants', 'Multi-tenant commercial usage', 'Priority product updates', 'Priority support', 'Same validated 416-control assessment engine'],
  },
];

export default function PricingClient({ checkoutEnabled }: { checkoutEnabled: boolean }) {
  const [loading, setLoading] = useState<Edition | null>(null);
  const [error, setError] = useState('');

  async function startCheckout(edition: Edition) {
    if (!checkoutEnabled) return;
    setError(''); setLoading(edition);
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ edition }) });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Unable to start checkout.');
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout.');
      setLoading(null);
    }
  }

  return <main className="pricing-page">
    <style jsx global>{`
      *{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#07111f}body{color:#f5f7fa;font-family:Inter,Arial,sans-serif}a{color:inherit}
      .pricing-page{min-height:100vh;background:radial-gradient(circle at 50% 0%,rgba(76,141,255,.14),transparent 34%),linear-gradient(180deg,#07111f 0%,#0d1321 100%)}
      .pricing-nav{width:min(1180px,calc(100% - 40px));margin:0 auto;padding:24px 0;display:flex;align-items:center;justify-content:space-between;gap:18px}.pricing-brand{font:700 24px 'Space Grotesk',Inter,sans-serif;text-decoration:none}.pricing-back{display:inline-flex;align-items:center;gap:8px;color:#a9b7cd;text-decoration:none;font-size:14px}
      .pricing-wrap{width:min(1080px,calc(100% - 40px));margin:0 auto;padding:64px 0 96px}.pricing-hero{text-align:center;max-width:760px;margin:0 auto 46px}.pricing-kicker{color:#6aa7ff;font:600 12px 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase}.pricing-hero h1{margin:14px 0 16px;font:700 clamp(36px,6vw,58px)/1.05 'Space Grotesk',Inter,sans-serif;letter-spacing:-.025em}.pricing-hero p{margin:0 auto;color:#8b95a5;font-size:17px;line-height:1.7;max-width:700px}.status-badge{display:inline-flex;align-items:center;gap:7px;margin-top:20px;padding:7px 11px;border:1px solid rgba(106,167,255,.35);border-radius:999px;color:#b7d0ff;background:rgba(76,141,255,.08);font-size:12px}
      .pricing-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px}.plan-card{position:relative;padding:30px;border:1px solid #26334a;border-radius:16px;background:rgba(20,27,43,.94);box-shadow:0 24px 70px -42px rgba(0,0,0,.9)}.plan-card.professional{border-color:rgba(76,141,255,.68);box-shadow:0 24px 80px -38px rgba(76,141,255,.35)}.popular{position:absolute;top:18px;right:18px;padding:6px 9px;border-radius:999px;background:rgba(76,141,255,.12);color:#82b2ff;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
      .plan-name{margin:0;font:700 24px 'Space Grotesk',Inter,sans-serif}.plan-description{min-height:76px;margin:12px 0 22px;color:#8b95a5;font-size:14px;line-height:1.65}.plan-price{display:flex;align-items:baseline;gap:7px;margin-bottom:6px}.plan-price strong{font:700 44px 'Space Grotesk',Inter,sans-serif}.plan-price span{color:#8b95a5}.tenant-label{color:#b9c7dc;font-size:13px;margin-bottom:24px}.plan-features{list-style:none;padding:20px 0 0;margin:0 0 26px;border-top:1px solid #26334a;display:grid;gap:13px}.plan-features li{display:flex;align-items:flex-start;gap:10px;color:#dfe7f4;font-size:14px;line-height:1.45}.plan-features svg{flex:0 0 auto;margin-top:1px;color:#5ea1ff}
      .checkout-button{width:100%;min-height:50px;border-radius:9px;border:1px solid #4c8dff;background:#4c8dff;color:#07111f;font:700 15px Inter,sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px}.checkout-button.secondary{background:transparent;color:#f5f7fa;border-color:#3a4962}.checkout-button:disabled{opacity:.58;cursor:not-allowed}.pricing-error{margin:20px auto 0;max-width:680px;padding:12px 14px;border:1px solid rgba(248,113,113,.35);border-radius:9px;color:#fecaca;background:rgba(248,113,113,.08);text-align:center;font-size:14px}.pricing-note{margin:34px auto 0;max-width:820px;color:#7f8da1;text-align:center;font-size:13px;line-height:1.65}
      @media(max-width:760px){.pricing-grid{grid-template-columns:1fr}.pricing-wrap{padding-top:38px}.plan-description{min-height:0}.pricing-nav{width:min(100% - 28px,1180px)}.pricing-wrap{width:min(100% - 28px,1080px)}}
    `}</style>
    <nav className="pricing-nav" aria-label="Pricing navigation"><a className="pricing-brand" href="/">TenantIQ</a><a className="pricing-back" href="/"><ArrowLeft size={16}/> Back to product</a></nav>
    <div className="pricing-wrap">
      <section className="pricing-hero"><div className="pricing-kicker">TenantIQ subscriptions</div><h1>Choose the TenantIQ plan that fits your environment.</h1><p>Both plans use the validated TenantIQ v1.1.0 assessment platform: 416 registered controls across eight Microsoft 365 workloads, with read-only collection and evidence-backed findings.</p><div className="status-badge"><Lock size={13}/>{checkoutEnabled?'Secure Stripe checkout':'Plans available for review — purchases opening soon'}</div></section>
      <section className="pricing-grid" aria-label="TenantIQ pricing plans">{plans.map(plan=>{const professional=plan.edition==='Professional';const disabled=!checkoutEnabled||loading!==null;return <article key={plan.edition} className={`plan-card ${professional?'professional':''}`}>{professional&&<div className="popular">Most flexible</div>}<ShieldCheck size={27} color="#6aa7ff" style={{marginBottom:16}}/><h2 className="plan-name">TenantIQ {plan.edition}</h2><p className="plan-description">{plan.description}</p><div className="plan-price"><strong>{plan.price}</strong><span>{plan.cadence}</span></div><div className="tenant-label">{plan.tenantLabel}</div><ul className="plan-features">{plan.features.map(feature=><li key={feature}><Check size={17}/><span>{feature}</span></li>)}</ul><button className={`checkout-button ${professional?'':'secondary'}`} disabled={disabled} onClick={()=>startCheckout(plan.edition)}>{loading===plan.edition?<><Loader2 size={18}/> Opening checkout…</>:checkoutEnabled?<>Choose {plan.edition}</>:<>Purchases opening soon</>}</button></article>})}</section>
      {error&&<div className="pricing-error" role="alert">{error}</div>}
      <p className="pricing-note">Annual subscription. Applicable sales tax is calculated at checkout. Subscriptions can be managed through the TenantIQ customer portal and canceled at the end of the current billing period.</p>
    </div>
  </main>;
}
