import { redirect } from 'next/navigation';
import TenantIQAssistant from '../../components/TenantIQAssistant';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import { auth } from '../../auth';

export default async function AssistantPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)' }}>
      <TenantIQAppNav active="assistant" />
      <TenantIQAssistant />
    </main>
  );
}
