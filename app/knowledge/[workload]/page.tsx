import { notFound, redirect } from 'next/navigation';
import TenantIQAppNav from '../../../components/TenantIQAppNav';
import { requireTenantIQEntitlement } from '../../../lib/tenantiq-entitlement';
import { getKnowledgeWorkload } from '../../../lib/knowledge-catalog';

export default async function KnowledgeWorkloadPage({ params }: { params: Promise<{ workload: string }> }) {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  const { workload: workloadSlug } = await params;
  const workload = getKnowledgeWorkload(workloadSlug);
  if (!workload) notFound();

  const categories = [...new Set(workload.controls.map((control) => control.category))];

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="knowledge" />
      <div style={{ width: 'min(1120px,100%)', margin: '0 auto', padding: '38px 20px 72px' }}>
        <a href="/knowledge" style={{ color: '#78b8ff', textDecoration: 'none', fontWeight: 800, fontSize: 13 }}>← Knowledge base</a>
        <header style={{ margin: '24px 0 28px' }}>
          <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>{workload.name} knowledge</div>
          <h1 style={{ fontSize: 'clamp(38px,6vw,58px)', lineHeight: 1.03, margin: '10px 0 14px' }}>{workload.name} guidance library.</h1>
          <p style={{ margin: 0, color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, maxWidth: 850 }}>{workload.description} The library is generated from normalized TenantIQ control metadata so the same interface can scale across workloads without hand-building each page.</p>
        </header>

        <section style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {categories.map((category) => <span key={category} style={{ border: '1px solid rgba(86,160,255,.2)', borderRadius: 999, padding: '6px 10px', color: '#9fcaff', background: 'rgba(47,135,255,.06)', fontSize: 11, fontWeight: 800 }}>{category}</span>)}
        </section>

        <section style={{ border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 22 }}>
          <div style={{ color: '#6eb5ff', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>Assessment controls</div>
          <h2 style={{ margin: '8px 0 8px', fontSize: 27 }}>{workload.controls.length} controls currently indexed</h2>
          <p style={{ margin: '0 0 20px', color: '#9fb0c2', lineHeight: 1.6, fontSize: 14, maxWidth: 820 }}>Each row uses the same reusable article route. Adding another normalized control to the catalog automatically gives it a workload listing, article page, and Assistant handoff.</p>
          <div style={{ display: 'grid', gap: 0 }}>
            {workload.controls.map((control) => (
              <div key={control.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(125px,.8fr) minmax(220px,1.5fr) minmax(150px,1fr) auto', gap: 14, alignItems: 'center', borderTop: '1px solid rgba(86,160,255,.13)', padding: '14px 4px' }}>
                <div style={{ color: '#79baff', fontSize: 12, fontWeight: 900 }}>{control.id}</div>
                <div style={{ color: '#f2f6fb', fontSize: 14, fontWeight: 800 }}>{control.title}</div>
                <div style={{ color: '#8fa4ba', fontSize: 12 }}>{control.category}</div>
                <a href={`/knowledge/${workload.slug}/${control.id.toLowerCase()}`} style={{ color: '#78b8ff', fontSize: 12, fontWeight: 850, textDecoration: 'none', whiteSpace: 'nowrap' }}>Read article →</a>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginTop: 20, border: '1px solid rgba(255,196,64,.22)', borderRadius: 16, background: 'rgba(255,196,64,.04)', padding: 22 }}>
          <div style={{ color: '#ffd35a', fontSize: 11, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>Evidence guardrail</div>
          <h2 style={{ margin: '8px 0 8px', fontSize: 23 }}>Knowledge explains the control; the assessment supplies the tenant facts.</h2>
          <p style={{ margin: 0, color: '#b4c1cf', lineHeight: 1.65, fontSize: 14 }}>TenantIQ should use the selected assessment for statuses, counts, users, policies, objects, configuration values, and severity. The knowledge library supplies interpretation and remediation context without inventing tenant-specific evidence.</p>
        </section>
      </div>
    </main>
  );
}
