import { redirect } from 'next/navigation';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import TenantIQWorkflow from '../../components/TenantIQWorkflow';
import { requireTenantIQEntitlement } from '../../lib/tenantiq-entitlement';

export default async function WorkflowPage({
  searchParams,
}: {
  searchParams: Promise<{ finding?: string | string[] }>;
}) {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  const params = await searchParams;
  const requestedFinding = Array.isArray(params.finding) ? params.finding[0] : params.finding;
  const initialFinding = String(requestedFinding || '').trim().slice(0, 160);

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="workflow" />
      <div style={{ width: 'min(1120px,100%)', margin: '0 auto', padding: '40px 20px 72px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ workflow</div>
          <h1 style={{ fontSize: 'clamp(36px,6vw,56px)', lineHeight: 1.05, margin: '10px 0 12px' }}>Turn findings into remediation work.</h1>
          <p style={{ maxWidth: 820, color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, margin: 0 }}>
            TenantIQ builds a prioritized remediation queue from the latest stored assessment for each workload. Review the evidence, use the recommendation, validate the change, and then re-run the assessment to confirm the finding is resolved.
          </p>
        </div>
        <TenantIQWorkflow initialFinding={initialFinding} />
        {initialFinding ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var n=0;function f(){var e=document.getElementById('focused-remediation');if(e){e.scrollIntoView({behavior:'smooth',block:'center'});return;}if(++n<40)setTimeout(f,125);}setTimeout(f,150);})();`,
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
