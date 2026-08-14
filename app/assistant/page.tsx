import { redirect } from 'next/navigation';
import TenantIQAssistant from '../../components/TenantIQAssistant';
import { auth } from '../../auth';

export default async function AssistantPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/signin');
  }

  return <TenantIQAssistant signedInUser={session.user.name || session.user.email || undefined} />;
}
