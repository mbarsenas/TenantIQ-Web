import { redirect } from 'next/navigation';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import { requireTenantIQEntitlement } from '../../lib/tenantiq-entitlement';

const workloads = [
  ['Entra ID', 'Identity, authentication, access, and directory posture.'],
  ['Exchange Online', 'Mail flow, authentication, transport, and messaging security guidance.'],
  ['SharePoint Online', 'Sharing, governance, permissions, and collaboration controls.'],
  ['Teams', 'Meetings, messaging, external access, and collaboration policy guidance.'],
  ['OneDrive', 'Sharing, device access, sync, and personal storage controls.'],
  ['Intune', 'Device compliance, configuration, application, and endpoint management guidance.'],
  ['Defender', 'Microsoft 365 security controls, protection, alerting, and response guidance.'],
  ['Microsoft Purview', 'Audit, retention, data governance, compliance, and information protection guidance.'],
] as const;

export default async function KnowledgePage() {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="knowledge" />
      <div style={{ width: 'min(1100px,100%)', margin: '0 auto', padding: '40px 20px 72px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ knowledge base</div>
          <h1 style={{ fontSize: 'clamp(34px,6vw,56px)', margin: '10px 0 12px', lineHeight: 1.05 }}>Microsoft 365 guidance, organized by workload.</h1>
          <p style={{ margin: 0, color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, maxWidth: 820 }}>
            TenantIQ uses its knowledge base to support assessment interpretation, remediation guidance, and validation context in the Knowledge Assistant.
          </p>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14 }}>
          {workloads.map(([name, description]) => (
            <article key={name} style={{ border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 20, minHeight: 170, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Workload guidance</div>
                <h2 style={{ margin: '0 0 10px', fontSize: 21 }}>{name}</h2>
                <p style={{ margin: 0, color: '#9fb0c2', lineHeight: 1.55, fontSize: 14 }}>{description}</p>
              </div>
              <a href="/assistant" style={{ marginTop: 18, color: '#78b8ff', fontSize: 13, fontWeight: 850, textDecoration: 'none' }}>Ask TenantIQ →</a>
            </article>
          ))}
        </section>

        <section style={{ marginTop: 24, border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 22 }}>
          <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>How to use it</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 24 }}>Start with the assessment, then use the knowledge.</h2>
          <p style={{ margin: 0, color: '#9fb0c2', lineHeight: 1.6, fontSize: 14 }}>
            Open a stored assessment, select a finding, and send it to the Assistant. TenantIQ combines that assessment evidence with relevant knowledge-base guidance so the answer stays grounded in the tenant data you selected.
          </p>
        </section>
      </div>
    </main>
  );
}
