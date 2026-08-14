import { redirect } from 'next/navigation';
import TenantIQAssistant from '../../components/TenantIQAssistant';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import TenantIQAssistantPrefill from '../../components/TenantIQAssistantPrefill';
import { requireTenantIQEntitlement } from '../../lib/tenantiq-entitlement';

export default async function AssistantPage() {
  const { session, entitlement } = await requireTenantIQEntitlement();
  if (!session?.user?.id) redirect('/signin');
  if (!entitlement.entitled) redirect('/license-required');

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="assistant" />
      <TenantIQAssistantPrefill />
      <TenantIQAssistant />
    </main>
  );
}
