import { redirect } from 'next/navigation';
import TenantIQAssistant from '../../components/TenantIQAssistant';
import { auth } from '../../auth';

export default async function AssistantPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) {
    redirect('/signin');
  }

  return <TenantIQAssistant />;
}
