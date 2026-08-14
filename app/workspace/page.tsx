import { redirect } from 'next/navigation';
import { auth } from '../../auth';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import TenantIQWorkspaceDashboard from '../../components/TenantIQWorkspaceDashboard';

export default async function WorkspacePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const name = session.user.name || session.user.email || 'TenantIQ user';

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="dashboard" />
      <div style={{ width: 'min(1040px,100%)', margin: '0 auto', padding: '42px 20px 64px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ workspace</div>
          <h1 style={{ fontSize: 'clamp(34px,6vw,54px)', lineHeight: 1.05, margin: '10px 0 12px' }}>Welcome, {name}.</h1>
          <p style={{ color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, margin: 0, maxWidth: 720 }}>Your workspace brings together current assessment posture, stored assessments, the Knowledge Assistant, and account management.</p>
        </div>

        <TenantIQWorkspaceDashboard />

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          <WorkspaceCard title="Assessments" text="Review the assessments stored in your TenantIQ workspace and open them in the assistant." href="/assessments" action="View assessments" />
          <WorkspaceCard title="Knowledge Assistant" text="Ask read-only questions grounded in your selected TenantIQ assessment and knowledge base." href="/assistant" action="Open Assistant" />
          <WorkspaceCard title="Account" text="Manage your profile, password, and email verification settings." href="/account" action="Manage account" />
        </section>
      </div>
    </main>
  );
}

function WorkspaceCard({ title, text, href, action }: { title: string; text: string; href: string; action: string }) {
  return (
    <article style={{ border: '1px solid rgba(86,160,255,.18)', borderRadius: 16, background: 'rgba(8,22,40,.72)', padding: 22, minHeight: 190, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <h2 style={{ margin: '0 0 10px', fontSize: 22 }}>{title}</h2>
        <p style={{ margin: 0, color: '#98a8ba', lineHeight: 1.6, fontSize: 14 }}>{text}</p>
      </div>
      <a href={href} style={{ marginTop: 22, color: '#8fc7ff', fontWeight: 850, textDecoration: 'none', fontSize: 14 }}>{action} →</a>
    </article>
  );
}
