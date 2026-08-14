import { redirect } from 'next/navigation';
import TenantIQAppNav from '../../../../components/TenantIQAppNav';
import { requireTenantIQEntitlement } from '../../../../lib/tenantiq-entitlement';

const panel = { border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 22 } as const;

export default async function DkimKnowledgePage() {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="knowledge" />
      <div style={{ width: 'min(980px,100%)', margin: '0 auto', padding: '38px 20px 72px' }}>
        <a href="/knowledge#exchange-guidance" style={{ color: '#78b8ff', textDecoration: 'none', fontWeight: 800, fontSize: 13 }}>← Exchange Online guidance</a>

        <header style={{ margin: '24px 0 28px' }}>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>EXO-MF-003</span>
            <span style={{ border: '1px solid rgba(255,196,64,.28)', background: 'rgba(255,196,64,.08)', color: '#ffd35a', borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 850 }}>Exchange Online</span>
            <span style={{ color: '#9eb0c4', fontSize: 11 }}>Mail authentication</span>
          </div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,58px)', lineHeight: 1.03, margin: '0 0 14px' }}>DKIM</h1>
          <p style={{ margin: 0, color: '#aeb8c8', fontSize: 17, lineHeight: 1.65, maxWidth: 820 }}>
            TenantIQ uses EXO-MF-003 to assess DKIM configuration in Exchange Online. Guidance for this control stays evidence-bound to the assessment so TenantIQ does not invent tenant configuration that was not actually observed.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 16 }}>
          <section style={panel}>
            <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Control purpose</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>What this check represents</h2>
            <p style={{ margin: 0, color: '#b4c1cf', lineHeight: 1.7 }}>This check evaluates the TenantIQ control represented by DKIM, DKIM configuration, and DomainKeys Identified Mail. A FAIL or WARNING means the observed configuration, coverage, inventory, or governance state requires review against the organization&apos;s approved Microsoft 365 baseline.</p>
          </section>

          <section style={panel}>
            <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Assessment interpretation</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Evidence TenantIQ should review</h2>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#b4c1cf', lineHeight: 1.85 }}>
              <li>Check ID, title, workload, category, status, and severity.</li>
              <li>The evidence returned by the EXO-MF-003 health check.</li>
              <li>Counts, domain names, configuration values, objects, or scope explicitly present in that evidence.</li>
              <li>The TenantIQ recommendation attached to the finding.</li>
            </ul>
          </section>

          <section style={panel}>
            <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Why it matters</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Risk is tied to the observed finding</h2>
            <p style={{ margin: 0, color: '#b4c1cf', lineHeight: 1.7 }}>Weak or incomplete configuration in this area can create avoidable security, compliance, governance, reliability, or operational risk. TenantIQ should tie any risk statement directly to the status, severity, evidence, and recommendation returned by the assessment rather than assuming configuration that is not present in the evidence.</p>
          </section>

          <section style={panel}>
            <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Remediation workflow</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Recommended remediation approach</h2>
            <ol style={{ margin: 0, paddingLeft: 22, color: '#b4c1cf', lineHeight: 1.85 }}>
              <li>Confirm the finding is in scope for the tenant and Exchange Online workload.</li>
              <li>Validate the reported evidence in the relevant Microsoft 365 admin experience or API before making changes.</li>
              <li>Apply the least-privilege and least-exposure configuration that satisfies business requirements.</li>
              <li>Document approved exceptions and ownership when the recommended baseline is intentionally not applied.</li>
              <li>Re-run the TenantIQ assessment after remediation and verify the finding state changed as expected.</li>
            </ol>
          </section>

          <section style={{ ...panel, borderColor: 'rgba(255,196,64,.25)', background: 'rgba(255,196,64,.045)' }}>
            <div style={{ color: '#ffd35a', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Interpretation guardrails</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Keep the answer grounded</h2>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#c1c8d0', lineHeight: 1.85 }}>
              <li>Do not claim remediation has been performed.</li>
              <li>Do not invent missing tenant settings, identities, counts, policy names, or attack paths.</li>
              <li>If assessment evidence is incomplete, state that additional validation is required.</li>
              <li>Prefer the finding&apos;s own TenantIQ recommendation when it is more specific than general guidance.</li>
            </ul>
          </section>

          <section style={{ ...panel, display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Use your tenant evidence</div>
              <h2 style={{ margin: '8px 0 6px', fontSize: 23 }}>Ask TenantIQ about EXO-MF-003</h2>
              <p style={{ margin: 0, color: '#9fb0c2', lineHeight: 1.55, fontSize: 14 }}>Open the Knowledge Assistant and investigate DKIM against the selected assessment.</p>
            </div>
            <a href="/assistant?finding=EXO-MF-003" style={{ display: 'inline-block', borderRadius: 10, padding: '12px 17px', background: '#2f87ff', color: '#fff', fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap' }}>Ask about DKIM →</a>
          </section>
        </div>
      </div>
    </main>
  );
}
