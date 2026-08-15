import { redirect } from 'next/navigation';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import TenantIQWorkspaceDashboard from '../../components/TenantIQWorkspaceDashboard';
import { requireTenantIQEntitlement } from '../../lib/tenantiq-entitlement';

export default async function WorkspacePage() {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  const name = session.user.name || session.user.email || 'TenantIQ user';
  const edition = entitlement.edition || 'TenantIQ';
  const subscriptionStatus = entitlement.status || 'active';
  const licenseExpiresAt = entitlement.licenseExpiresAt
    ? new Date(entitlement.licenseExpiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="dashboard" />
      <div style={{ width: 'min(1120px,100%)', margin: '0 auto', padding: '42px 20px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 20, alignItems: 'end', marginBottom: 28 }}>
          <div>
            <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ workspace</div>
            <h1 style={{ fontSize: 'clamp(34px,6vw,54px)', lineHeight: 1.05, margin: '10px 0 12px' }}>Welcome, {name}.</h1>
            <p style={{ color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, margin: 0, maxWidth: 760 }}>
              Your workspace brings together tenant posture, stored assessments, the Assistant, knowledge guidance, remediation workflow, and account licensing.
            </p>
          </div>
          <a href="/assessments" style={primaryButtonStyle}>Open assessments</a>
        </div>

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginBottom: 20 }} aria-label="TenantIQ license summary">
          <SummaryTile label="Edition" value={edition} />
          <SummaryTile label="Subscription" value={formatStatus(subscriptionStatus)} />
          <SummaryTile label="Licensed domain" value={entitlement.licensedDomain || 'Not restricted'} />
          <SummaryTile label="License expiration" value={licenseExpiresAt || 'Managed by subscription'} />
        </section>

        <TenantIQWorkspaceDashboard />

        <section style={{ marginTop: 28 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>Workspace tools</div>
            <h2 style={{ margin: '6px 0 0', fontSize: 24 }}>Continue your TenantIQ workflow</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
            <WorkspaceCard title="Assessments" text="Review stored assessments, upload new workload results, and open detailed findings." href="/assessments" action="View assessments" />
            <WorkspaceCard title="Assistant" text="Ask read-only questions grounded in your selected TenantIQ assessment and stored findings." href="/assistant" action="Open Assistant" />
            <WorkspaceCard title="Knowledge" text="Browse TenantIQ guidance and Microsoft documentation organized around the eight supported workloads." href="/knowledge" action="Browse knowledge" />
            <WorkspaceCard title="Workflow" text="Track findings that need review, remediation in progress, and completed work across your tenant." href="/workflow" action="Open workflow" />
            <WorkspaceCard title="Account & subscription" text="Review your TenantIQ edition, license status, subscription details, and account settings." href="/account" action="Manage account" />
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid rgba(86,160,255,.17)', borderRadius: 14, background: 'rgba(8,22,40,.66)', padding: 15 }}>
      <div style={{ color: '#8192a6', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
      <div style={{ color: '#eef5fd', fontSize: 17, fontWeight: 850, marginTop: 6, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}

function WorkspaceCard({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return (
    <article style={{ border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 22, minHeight: 190, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <h3 style={{ margin: '0 0 10px', fontSize: 21 }}>{title}</h3>
        <p style={{ margin: 0, color: '#98a8ba', lineHeight: 1.6, fontSize: 14 }}>{text}</p>
      </div>
      <a href={href} style={{ marginTop: 22, color: '#8fc7ff', fontWeight: 850, textDecoration: 'none', fontSize: 14 }}>{action} →</a>
    </article>
  );
}

function formatStatus(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const primaryButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
  padding: '0 16px',
  borderRadius: 10,
  background: '#2f87ff',
  color: '#fff',
  fontSize: 13,
  fontWeight: 850,
  textDecoration: 'none',
  whiteSpace: 'nowrap' as const,
};
