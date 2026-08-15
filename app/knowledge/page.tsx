import { redirect } from 'next/navigation';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import { requireTenantIQEntitlement } from '../../lib/tenantiq-entitlement';
import { knowledgeWorkloads } from '../../lib/knowledge-catalog';

type WorkloadCard = {
  name: string;
  slug: string;
  description: string;
  explicitCount?: number;
};

const workloadCards: WorkloadCard[] = [
  { name: 'Entra ID', slug: 'entra', description: 'Identity, authentication, Conditional Access, applications, and governance guidance.', explicitCount: 8 },
  { name: 'Exchange Online', slug: 'exchange', description: 'Mail flow, authentication, transport, and messaging security guidance.', explicitCount: 10 },
  { name: 'SharePoint Online', slug: 'sharepoint', description: 'Sharing, governance, permissions, lifecycle, and collaboration controls.' },
  { name: 'Teams', slug: 'teams', description: 'Meetings, messaging, external access, devices, apps, and collaboration policy guidance.' },
  { name: 'OneDrive', slug: 'onedrive', description: 'Sharing, device access, sync, lifecycle, recovery, and personal storage controls.' },
  { name: 'Intune', slug: 'intune', description: 'Device compliance, enrollment, configuration, application, endpoint, and Windows management guidance.' },
  { name: 'Defender', slug: 'defender', description: 'Email protection, endpoint security, identity protection, incidents, hunting, and response guidance.' },
  { name: 'Microsoft Purview', slug: 'purview', description: 'Audit, retention, information protection, DLP, records, eDiscovery, and compliance guidance.' },
];

function indexedCount(name: string, explicitCount?: number) {
  if (explicitCount !== undefined) return explicitCount;
  return knowledgeWorkloads.find((item) => item.name === name)?.controls.length || 0;
}

export default async function KnowledgePage() {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  const totalControls = workloadCards.reduce((sum, workload) => sum + indexedCount(workload.name, workload.explicitCount), 0);

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="knowledge" />
      <div style={{ width: 'min(1120px,100%)', margin: '0 auto', padding: '40px 20px 72px' }}>
        <header style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 20, alignItems: 'end', marginBottom: 28 }}>
          <div>
            <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ knowledge base</div>
            <h1 style={{ fontSize: 'clamp(34px,6vw,56px)', margin: '10px 0 12px', lineHeight: 1.05 }}>Microsoft 365 guidance, organized by workload.</h1>
            <p style={{ margin: 0, color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, maxWidth: 840 }}>Use the knowledge library to understand what a TenantIQ control represents, how to validate the finding, and how to approach remediation. Tenant-specific facts still come from the assessment you selected.</p>
          </div>
          <a href="/assistant" style={primaryLinkStyle}>Open Assistant</a>
        </header>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 24 }} aria-label="Knowledge coverage summary">
          <Metric label="Supported workloads" value="8" />
          <Metric label="Indexed controls" value={String(totalControls)} />
          <Metric label="Knowledge mode" value="Read-only" />
          <Metric label="Tenant evidence" value="Assessment-bound" />
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(245px,1fr))', gap: 14 }}>
          {workloadCards.map((workload) => {
            const count = indexedCount(workload.name, workload.explicitCount);
            return (
              <article key={workload.name} style={{ border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 20, minHeight: 190, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>Workload guidance</div>
                  <h2 style={{ margin: '0 0 10px', fontSize: 21 }}>{workload.name}</h2>
                  <p style={{ margin: 0, color: '#9fb0c2', lineHeight: 1.55, fontSize: 14 }}>{workload.description}</p>
                  <div style={{ marginTop: 12, color: '#79a7d2', fontSize: 12, fontWeight: 850 }}>{count} controls indexed</div>
                </div>
                <a href={`/knowledge/${workload.slug}`} style={{ marginTop: 18, color: '#78b8ff', fontSize: 13, fontWeight: 850, textDecoration: 'none' }}>View {workload.name} guidance →</a>
              </article>
            );
          })}
        </section>

        <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>
          <article style={panelStyle}>
            <div style={eyebrowStyle}>Assessment workflow</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 23 }}>Start with a finding</h2>
            <p style={bodyStyle}>Open a stored assessment, review the evidence for a finding, then use its knowledge article to understand the control and remediation intent.</p>
            <a href="/assessments" style={secondaryLinkStyle}>Browse assessments →</a>
          </article>
          <article style={panelStyle}>
            <div style={eyebrowStyle}>Assistant workflow</div>
            <h2 style={{ margin: '8px 0 10px', fontSize: 23 }}>Ask with tenant context</h2>
            <p style={bodyStyle}>Knowledge articles can hand a control directly to the Assistant. The Assistant then combines that question with whichever assessment you select.</p>
            <a href="/assistant" style={secondaryLinkStyle}>Open Assistant →</a>
          </article>
        </section>

        <section style={{ marginTop: 20, border: '1px solid rgba(255,196,64,.22)', borderRadius: 16, background: 'rgba(255,196,64,.04)', padding: 22 }}>
          <div style={{ color: '#ffd35a', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>Evidence guardrail</div>
          <h2 style={{ margin: '8px 0 8px', fontSize: 23 }}>Knowledge explains the control; the assessment supplies the tenant facts.</h2>
          <p style={{ margin: 0, color: '#b4c1cf', lineHeight: 1.65, fontSize: 14 }}>Statuses, severity, counts, users, policies, objects, configuration values, and scope must come from the selected assessment. The knowledge library supplies interpretation and remediation context without inventing tenant-specific evidence.</p>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid rgba(86,160,255,.17)', borderRadius: 14, background: 'rgba(8,22,40,.66)', padding: 15 }}>
      <div style={{ color: '#8192a6', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ color: '#eef5fd', fontSize: 22, fontWeight: 900, marginTop: 6 }}>{value}</div>
    </div>
  );
}

const panelStyle = { border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 22 };
const eyebrowStyle = { color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' as const };
const bodyStyle = { margin: '0 0 18px', color: '#9fb0c2', lineHeight: 1.6, fontSize: 14 };
const primaryLinkStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 16px', borderRadius: 10, background: '#2f87ff', color: '#fff', fontSize: 13, fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' as const };
const secondaryLinkStyle = { color: '#78b8ff', fontSize: 13, fontWeight: 850, textDecoration: 'none' };
