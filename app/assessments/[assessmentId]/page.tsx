import { redirect } from 'next/navigation';
import TenantIQAppNav from '../../../components/TenantIQAppNav';
import TenantIQAssessmentDetail from '../../../components/TenantIQAssessmentDetail';
import { requireTenantIQEntitlement } from '../../../lib/tenantiq-entitlement';

export default async function AssessmentDetailPage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  const { assessmentId } = await params;

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="assessments" />
      <div style={{ width: 'min(1120px,100%)', margin: '0 auto', padding: '38px 20px 64px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
          <div>
            <a href="/assessments" style={{ color: '#8fc7ff', textDecoration: 'none', fontWeight: 800, fontSize: 13 }}>← Assessment history</a>
            <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 20 }}>TenantIQ assessment</div>
            <h1 style={{ fontSize: 'clamp(32px,5vw,50px)', lineHeight: 1.06, margin: '9px 0 10px' }}>Assessment findings.</h1>
            <p style={{ maxWidth: 760, color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, margin: 0 }}>Filter the assessment by status or severity, review collected evidence and recommendations, then send any finding directly to the Knowledge Assistant.</p>
          </div>
        </div>
        <TenantIQAssessmentDetail assessmentId={assessmentId} />
      </div>
    </main>
  );
}
