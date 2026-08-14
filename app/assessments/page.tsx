import { redirect } from 'next/navigation';
import { auth } from '../../auth';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import TenantIQAssessments from '../../components/TenantIQAssessments';

export default async function AssessmentsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="assessments" />
      <div style={{ width: 'min(1040px,100%)', margin: '0 auto', padding: '40px 20px 60px' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ assessments</div>
          <h1 style={{ fontSize: 'clamp(34px,6vw,54px)', lineHeight: 1.05, margin: '10px 0 12px' }}>Your assessment history.</h1>
          <p style={{ maxWidth: 720, color: '#aeb8c8', fontSize: 16, lineHeight: 1.65, margin: 0 }}>Review the TenantIQ assessments stored in your workspace and open any assessment directly in the Knowledge Assistant.</p>
        </div>
        <TenantIQAssessments />
      </div>
    </main>
  );
}
