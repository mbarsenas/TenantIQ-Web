import { redirect } from 'next/navigation';
import TenantIQAppNav from '../../../components/TenantIQAppNav';
import { requireTenantIQEntitlement } from '../../../lib/tenantiq-entitlement';

const controls = [
  ['EXO-MF-001','Accepted Domains','Mail Flow'],
  ['EXO-MF-002','Connectors','Mail Flow'],
  ['EXO-MF-003','DKIM','Mail Authentication'],
  ['EXO-MF-004','DMARC','Mail Authentication'],
  ['EXO-MF-005','Remote Domains','Mail Flow'],
  ['EXO-SEC-001','Anti-Spam Policies','Security'],
  ['EXO-SEC-002','Authentication Policies','Authentication'],
  ['EXO-SEC-003','External Forwarding','Security'],
  ['EXO-SEC-004','Mailbox Auditing','Security'],
  ['EXO-SEC-005','SMTP AUTH','Authentication'],
] as const;

const categories = [
  ['Mail Flow', 'Accepted domains, connectors, remote domains, and transport behavior.'],
  ['Mail Authentication', 'DKIM and DMARC configuration used to protect sending domains.'],
  ['Security', 'Anti-spam, forwarding, auditing, and messaging protection controls.'],
  ['Authentication', 'Authentication policies and SMTP AUTH exposure.'],
] as const;

export default async function ExchangeKnowledgePage() {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="knowledge" />
      <div style={{ width: 'min(1100px,100%)', margin: '0 auto', padding: '38px 20px 72px' }}>
        <a href="/knowledge" style={{ color: '#78b8ff', textDecoration: 'none', fontWeight: 800, fontSize: 13 }}>← Knowledge base</a>

        <header style={{ margin: '24px 0 28px' }}>
          <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Exchange Online knowledge</div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,58px)', lineHeight: 1.03, margin: '10px 0 14px' }}>Messaging and mail-security guidance.</h1>
          <p style={{ margin: 0, color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, maxWidth: 840 }}>TenantIQ uses Exchange Online guidance to interpret mail flow, authentication, transport, and messaging-security findings while keeping every conclusion tied to the selected assessment evidence.</p>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14, marginBottom: 28 }}>
          {categories.map(([name, description]) => (
            <article key={name} style={{ border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 20 }}>
              <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Guidance area</div>
              <h2 style={{ fontSize: 19, margin: '0 0 9px' }}>{name}</h2>
              <p style={{ margin: 0, color: '#9fb0c2', fontSize: 13, lineHeight: 1.6 }}>{description}</p>
            </article>
          ))}
        </section>

        <section style={{ border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 22 }}>
          <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>Assessment controls</div>
          <h2 style={{ margin: '8px 0 8px', fontSize: 27 }}>{controls.length} Exchange controls indexed</h2>
          <p style={{ margin: '0 0 20px', color: '#9fb0c2', lineHeight: 1.6, fontSize: 14, maxWidth: 820 }}>Open any control to review its interpretation guardrails, remediation workflow, and direct Assistant handoff.</p>
          <div style={{ display: 'grid', gap: 0 }}>
            {controls.map(([id, title, category]) => (
              <div key={id} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,.8fr) minmax(200px,1.5fr) minmax(140px,1fr) auto', gap: 14, alignItems: 'center', borderTop: '1px solid rgba(86,160,255,.13)', padding: '14px 4px' }}>
                <div style={{ color: '#79baff', fontSize: 12, fontWeight: 900 }}>{id}</div>
                <div style={{ color: '#f2f6fb', fontSize: 14, fontWeight: 800 }}>{title}</div>
                <div style={{ color: '#8fa4ba', fontSize: 12 }}>{category}</div>
                <a href={`/knowledge/exchange/${id.toLowerCase()}`} style={{ color: '#78b8ff', fontSize: 12, fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' }}>Read article →</a>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 20, border: '1px solid rgba(255,196,64,.22)', borderRadius: 16, background: 'rgba(255,196,64,.04)', padding: 22 }}>
          <div style={{ color: '#ffd35a', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>Evidence guardrail</div>
          <h2 style={{ margin: '8px 0 8px', fontSize: 23 }}>Exchange guidance does not replace tenant evidence.</h2>
          <p style={{ margin: 0, color: '#b4c1cf', lineHeight: 1.65, fontSize: 14 }}>TenantIQ should use the assessment for domains, connectors, policies, configuration values, status, and severity. The knowledge library explains what the control means and how to approach remediation without inventing Exchange Online configuration.</p>
        </section>
      </div>
    </main>
  );
}
