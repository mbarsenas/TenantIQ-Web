import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '../../auth';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import { getTenantIQEntitlement } from '../../lib/tenantiq-entitlement';

const reasonCopy: Record<string, string> = {
  no_purchase: 'TenantIQ could not find a matching TenantIQ purchase for this signed-in email address.',
  inactive: 'A TenantIQ subscription was found, but it is not currently active or trialing.',
  not_fulfilled: 'An active TenantIQ subscription was found, but license fulfillment is not complete yet.',
  stripe_unavailable: 'TenantIQ could not verify this license right now. Please try again shortly.',
  not_authenticated: 'TenantIQ could not determine the signed-in account.',
  active: 'TenantIQ found an active entitlement. Return to the workspace.',
};

export default async function LicenseRequiredPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const entitlement = await getTenantIQEntitlement(session.user.email);
  if (entitlement.entitled) redirect('/workspace');

  const reason = entitlement.reason;
  const message = reasonCopy[reason] || 'TenantIQ could not validate this account license.';

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav />
      <div style={{ width: 'min(760px,100%)', margin: '0 auto', padding: '72px 20px' }}>
        <section style={{ border: '1px solid rgba(86,160,255,.22)', borderRadius: 18, background: 'rgba(8,22,40,.78)', padding: 32 }}>
          <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ license</div>
          <h1 style={{ fontSize: 'clamp(32px,6vw,48px)', margin: '12px 0 14px', lineHeight: 1.08 }}>A TenantIQ license is required.</h1>
          <p style={{ color: '#aeb8c8', fontSize: 16, lineHeight: 1.7, margin: '0 0 20px' }}>
            The workspace, stored assessments, AI Assistant, Knowledge library, and remediation Workflow are available to customers with an active, fulfilled TenantIQ subscription. Sign in with the email address used for your TenantIQ purchase.
          </p>

          <div style={{ border: '1px solid rgba(244,196,48,.2)', background: 'rgba(244,196,48,.05)', borderRadius: 12, padding: '14px 16px', marginBottom: 24, color: '#dce7f4', lineHeight: 1.55, fontSize: 14 }}>
            {message}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/pricing" style={{ background: '#2f86ff', color: '#fff', padding: '12px 18px', borderRadius: 10, fontWeight: 850, textDecoration: 'none' }}>View TenantIQ plans</Link>
            <Link href="/account" style={{ border: '1px solid rgba(86,160,255,.35)', color: '#9dcbff', padding: '12px 18px', borderRadius: 10, fontWeight: 800, textDecoration: 'none' }}>Account & subscription</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
