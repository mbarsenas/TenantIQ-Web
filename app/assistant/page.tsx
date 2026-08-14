import { redirect } from 'next/navigation';
import TenantIQAssistant from '../../components/TenantIQAssistant';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import { auth } from '../../auth';

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ assessment?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const params = await searchParams;
  const initialAssessmentId = String(params.assessment || '').trim();

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="assistant" />
      <TenantIQAssistant initialAssessmentId={initialAssessmentId || undefined} />
    </main>
  );
}
