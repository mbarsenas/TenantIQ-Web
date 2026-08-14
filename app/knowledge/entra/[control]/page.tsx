import { notFound, redirect } from 'next/navigation';
import TenantIQAppNav from '../../../../components/TenantIQAppNav';
import { requireTenantIQEntitlement } from '../../../../lib/tenantiq-entitlement';

const controls: Record<string, { id: string; title: string; category: string; aliases: string }> = {
  'entra-gov-002': { id: 'ENTRA-GOV-002', title: 'Administrative Units', category: 'Identity Governance', aliases: 'administrative units, delegated administration scope, and governance boundaries' },
  'entra-app-001': { id: 'ENTRA-APP-001', title: 'Admin Consent Request Policy', category: 'Applications', aliases: 'admin consent request policy, consent governance, and approval controls' },
  'entra-app-002': { id: 'ENTRA-APP-002', title: 'Admin Consent Workflow', category: 'Applications', aliases: 'administrative consent workflow configuration and oversight' },
  'entra-app-003': { id: 'ENTRA-APP-003', title: 'App Registrations', category: 'Applications', aliases: 'application registrations, ownership, governance, and exposure' },
  'entra-app-004': { id: 'ENTRA-APP-004', title: 'Application Credentials', category: 'Applications', aliases: 'application secrets, certificates, and credential lifecycle' },
  'entra-app-006': { id: 'ENTRA-APP-006', title: 'Application Proxy', category: 'Applications', aliases: 'application proxy publishing and external application exposure' },
  'entra-ca-001': { id: 'ENTRA-CA-001', title: 'Authentication Context', category: 'Conditional Access', aliases: 'authentication context configuration used by Conditional Access policies' },
};

const panel = { border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 22 } as const;

export default async function EntraKnowledgeArticle({ params }: { params: Promise<{ control: string }> }) {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  const { control } = await params;
  const article = controls[control.toLowerCase()];
  if (!article) notFound();

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="knowledge" />
      <div style={{ width: 'min(980px,100%)', margin: '0 auto', padding: '38px 20px 72px' }}>
        <a href="/knowledge/entra" style={{ color: '#78b8ff', textDecoration: 'none', fontWeight: 800, fontSize: 13 }}>← Entra ID guidance</a>

        <header style={{ margin: '24px 0 28px' }}>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em' }}>{article.id}</span>
            <span style={{ border: '1px solid rgba(86,160,255,.28)', background: 'rgba(86,160,255,.08)', color: '#8fc8ff', borderRadius: 999, padding: '4px 9px', fontSize: 11, fontWeight: 850 }}>Entra ID</span>
            <span style={{ color: '#9eb0c4', fontSize: 11 }}>{article.category}</span>
          </div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,58px)', lineHeight: 1.03, margin: '0 0 14px' }}>{article.title}</h1>
          <p style={{ margin: 0, color: '#aeb8c8', fontSize: 17, lineHeight: 1.65, maxWidth: 820 }}>
            TenantIQ uses {article.id} to assess {article.aliases} in Entra ID. Guidance remains evidence-bound so TenantIQ does not invent tenant configuration that was not actually observed.
          </p>
        </header>

        <div style={{ display: 'grid', gap: 16 }}>
          <section style={panel}>
            <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Control purpose</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>What this check represents</h2>
            <p style={{ margin: 0, color: '#b4c1cf', lineHeight: 1.7 }}>This check evaluates the TenantIQ control represented by {article.title}. A FAIL or WARNING means the observed configuration, coverage, inventory, or governance state requires review against the organization&apos;s approved Microsoft 365 security, compliance, operational, or governance baseline.</p>
          </section>

          <section style={panel}>
            <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Assessment interpretation</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Evidence TenantIQ should review</h2>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#b4c1cf', lineHeight: 1.85 }}>
              <li>Check ID, title, workload, category, status, and severity.</li>
              <li>The evidence returned by the {article.id} health check.</li>
              <li>Counts, users, applications, policies, configuration values, objects, or scope explicitly present in the evidence.</li>
              <li>The TenantIQ recommendation attached to the finding.</li>
            </ul>
          </section>

          <section style={panel}>
            <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Why it matters</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Risk is tied to the observed finding</h2>
            <p style={{ margin: 0, color: '#b4c1cf', lineHeight: 1.7 }}>Weak or incomplete configuration in this area can create avoidable identity, security, compliance, governance, or operational risk. TenantIQ should tie any risk statement directly to the finding&apos;s reported status, severity, evidence, and recommendation.</p>
          </section>

          <section style={panel}>
            <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Remediation workflow</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Recommended remediation approach</h2>
            <ol style={{ margin: 0, paddingLeft: 22, color: '#b4c1cf', lineHeight: 1.85 }}>
              <li>Confirm the finding is in scope for the tenant and Entra ID workload.</li>
              <li>Validate the reported evidence in the Microsoft Entra admin center or Microsoft Graph before making changes.</li>
              <li>Apply the least-privilege and least-exposure configuration that satisfies the organization&apos;s business requirements.</li>
              <li>Document approved exceptions, ownership, and review dates where the recommended baseline is intentionally not applied.</li>
              <li>Re-run the TenantIQ assessment after remediation and verify the finding state changed as expected.</li>
            </ol>
          </section>

          <section style={{ ...panel, borderColor: 'rgba(255,196,64,.25)', background: 'rgba(255,196,64,.045)' }}>
            <div style={{ color: '#ffd35a', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Interpretation guardrails</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>Keep identity guidance grounded</h2>
            <ul style={{ margin: 0, paddingLeft: 20, color: '#c1c8d0', lineHeight: 1.85 }}>
              <li>Do not claim remediation has been performed.</li>
              <li>Do not invent missing users, applications, policies, assignments, counts, configuration values, or attack paths.</li>
              <li>If assessment evidence is incomplete, state that additional validation is required.</li>
              <li>Prefer the finding&apos;s own TenantIQ recommendation when it is more specific than this general guidance.</li>
            </ul>
          </section>

          <section style={{ ...panel, display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.07em', textTransform: 'uppercase' }}>Use your tenant evidence</div>
              <h2 style={{ margin: '8px 0 6px', fontSize: 23 }}>Ask TenantIQ about {article.id}</h2>
              <p style={{ margin: 0, color: '#9fb0c2', lineHeight: 1.55, fontSize: 14 }}>Open the Knowledge Assistant and investigate {article.title} against the selected assessment.</p>
            </div>
            <a href={`/assistant?finding=${encodeURIComponent(article.id)}`} style={{ display: 'inline-block', borderRadius: 10, padding: '12px 17px', background: '#2f87ff', color: '#fff', fontWeight: 900, textDecoration: 'none', whiteSpace: 'nowrap' }}>Ask about {article.title} →</a>
          </section>
        </div>
      </div>
    </main>
  );
}
