import { redirect } from 'next/navigation';
import { auth } from '../../auth';
import TenantIQAppNav from '../../components/TenantIQAppNav';
import { changePasswordForUser, createAuthToken, findUserById, updateUserName } from '../../lib/tenantiq-users';
import { sendVerificationEmail } from '../../lib/tenantiq-email';
import { getTenantIQEntitlement } from '../../lib/tenantiq-entitlement';

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ saved?: string; password?: string; verification?: string; error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  const params = await searchParams;
  const nativeAccount = session.user.id.startsWith('tenantiq:');
  const user = nativeAccount ? await findUserById(session.user.id) : null;
  const entitlement = await getTenantIQEntitlement(session.user.email);

  async function updateProfile(formData: FormData) {
    'use server';
    const sessionNow = await auth();
    if (!sessionNow?.user?.id?.startsWith('tenantiq:')) redirect('/signin');
    const ok = await updateUserName(sessionNow.user.id, String(formData.get('name') || '').trim());
    redirect(ok ? '/account?saved=1' : '/account?error=profile');
  }

  async function changePassword(formData: FormData) {
    'use server';
    const sessionNow = await auth();
    if (!sessionNow?.user?.id?.startsWith('tenantiq:')) redirect('/signin');
    const currentPassword = String(formData.get('currentPassword') || '');
    const newPassword = String(formData.get('newPassword') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    if (newPassword !== confirmPassword) redirect('/account?error=match');
    const result = await changePasswordForUser(sessionNow.user.id, currentPassword, newPassword);
    if (!result.ok) redirect(`/account?error=${result.reason}`);
    redirect('/account?password=1');
  }

  async function resendVerification() {
    'use server';
    const sessionNow = await auth();
    if (!sessionNow?.user?.id?.startsWith('tenantiq:')) redirect('/signin');
    const dbUser = await findUserById(sessionNow.user.id);
    if (!dbUser) redirect('/account?error=account');
    if (dbUser.email_verified) redirect('/account?verification=already');
    const token = await createAuthToken(String(dbUser.id), 'verify-email', 24 * 60);
    await sendVerificationEmail(String(dbUser.email), token);
    redirect('/account?verification=sent');
  }

  const errorMessage = params.error === 'match' ? 'The new passwords do not match.' : params.error === 'current' ? 'Your current password is incorrect.' : params.error === 'same' ? 'Choose a password different from your current password.' : params.error === 'weak' ? 'Use at least 12 characters for your new password.' : params.error ? 'TenantIQ could not complete that account change.' : null;
  const purchaseEmail = user?.email || session.user.email || 'Not available';

  return (
    <main style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb' }}>
      <TenantIQAppNav active="account" />
      <div style={{ width: 'min(1040px,100%)', margin: '0 auto', padding: '38px 20px 60px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={eyebrowStyle}>TenantIQ account</div>
          <h1 style={{ fontSize: 'clamp(34px,6vw,54px)', lineHeight: 1.05, margin: '10px 0 12px' }}>Account & subscription.</h1>
          <p style={{ color: '#aeb8c8', fontSize: 16, lineHeight: 1.6, margin: 0 }}>Review your TenantIQ access, subscription, and account security.</p>
        </div>

        {params.saved === '1' ? <Notice text="Profile updated." /> : null}
        {params.password === '1' ? <Notice text="Password changed successfully." /> : null}
        {params.verification === 'sent' ? <Notice text="Verification email sent. Check your inbox." /> : null}
        {params.verification === 'already' ? <Notice text="Your email is already verified." /> : null}
        {errorMessage ? <Notice text={errorMessage} error /> : null}

        <section style={{ display: 'grid', gap: 18 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                <div style={eyebrowStyle}>Subscription</div>
                <h2 style={{ ...headingStyle, marginTop: 7 }}>TenantIQ workspace access</h2>
                <div style={{ color: '#91a3b8', fontSize: 13, lineHeight: 1.55 }}>Entitlement is verified against the TenantIQ subscription associated with your purchase email.</div>
              </div>
              <StatusBadge active={entitlement.entitled} />
            </div>

            {entitlement.entitled ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, marginTop: 18 }}>
                  <LicenseField label="Edition" value={entitlement.edition || 'TenantIQ'} />
                  <LicenseField label="Subscription status" value={titleCase(entitlement.status || 'active')} />
                  <LicenseField label="Purchase email" value={purchaseEmail} />
                  <LicenseField label="Licensed domain" value={entitlement.licensedDomain || 'Not restricted'} />
                  <LicenseField label="Tenant allowance" value={entitlement.maxTenants ? `${entitlement.maxTenants} tenant${entitlement.maxTenants === '1' ? '' : 's'}` : 'Per subscription'} />
                  <LicenseField label="License expires" value={formatLicenseDate(entitlement.licenseExpiresAt)} />
                </div>
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(86,160,255,.12)', color: '#748ba6', fontSize: 12, lineHeight: 1.6 }}>
                  Subscription ID: <span style={monoStyle}>{maskIdentifier(entitlement.subscriptionId)}</span>{entitlement.licenseId ? <> &nbsp;·&nbsp; License ID: <span style={monoStyle}>{entitlement.licenseId}</span></> : null}
                </div>
              </>
            ) : (
              <div style={{ marginTop: 16, border: '1px solid rgba(248,113,113,.18)', background: 'rgba(248,113,113,.06)', borderRadius: 10, padding: '14px', color: '#fca5a5', fontSize: 13, lineHeight: 1.55 }}>
                <strong>Workspace access is not active.</strong><br />
                {entitlementMessage(entitlement.reason)}
                <div style={{ marginTop: 12 }}><a href="/pricing" style={primaryLinkStyle}>View TenantIQ plans</a></div>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 18 }}>
            <div style={cardStyle}>
              <div style={eyebrowStyle}>Profile</div>
              <h2 style={{ ...headingStyle, marginTop: 7 }}>Account identity</h2>
              <div style={{ display: 'grid', gap: 12 }}>
                <AccountField label="Email" value={purchaseEmail} />
                <AccountField label="Email verification" value={nativeAccount ? (user?.email_verified ? 'Verified' : 'Not verified') : 'Verified by Microsoft'} />
                <AccountField label="Sign-in method" value={nativeAccount ? 'TenantIQ account' : 'Microsoft account'} />
                {user?.last_login_at ? <AccountField label="Last sign-in" value={new Date(user.last_login_at).toLocaleString()} /> : null}
              </div>
              {nativeAccount ? <form action={updateProfile} style={{ display: 'grid', gap: 10, marginTop: 18 }}><label style={fieldLabelStyle}>Display name<input name="name" defaultValue={user?.name || session.user.name || ''} required style={inputStyle} /></label><button type="submit" style={primaryButtonStyle}>Save profile</button></form> : null}
            </div>

            <div style={cardStyle}>
              <div style={eyebrowStyle}>Security</div>
              <h2 style={{ ...headingStyle, marginTop: 7 }}>Account security</h2>
              {nativeAccount ? (
                <>
                  <div style={{ color: '#9ba8ba', fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>Password and email verification controls for your TenantIQ account.</div>
                  {!user?.email_verified ? <form action={resendVerification} style={{ marginBottom: 18 }}><button type="submit" style={secondaryButtonStyle}>Resend verification email</button></form> : <div style={{ color: '#86efac', fontSize: 13, marginBottom: 18 }}>✓ Email address verified</div>}
                  <form action={changePassword} style={{ display: 'grid', gap: 12 }}>
                    <label style={fieldLabelStyle}>Current password<input name="currentPassword" type="password" autoComplete="current-password" required style={inputStyle} /></label>
                    <label style={fieldLabelStyle}>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} required style={inputStyle} /></label>
                    <label style={fieldLabelStyle}>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required style={inputStyle} /></label>
                    <div style={{ color: '#748093', fontSize: 12 }}>Minimum 12 characters.</div>
                    <button type="submit" style={primaryButtonStyle}>Change password</button>
                  </form>
                </>
              ) : <div style={{ color: '#9ba8ba', fontSize: 13, lineHeight: 1.6 }}>This account signs in through Microsoft. Password and identity security are managed by your Microsoft identity provider.</div>}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ active }: { active: boolean }) { return <span style={{ borderRadius: 999, padding: '7px 11px', fontSize: 11, fontWeight: 900, background: active ? 'rgba(34,197,94,.12)' : 'rgba(248,113,113,.1)', color: active ? '#86efac' : '#fca5a5', border: `1px solid ${active ? 'rgba(34,197,94,.24)' : 'rgba(248,113,113,.22)'}` }}>{active ? 'ACTIVE' : 'NOT ACTIVE'}</span>; }
function LicenseField({ label, value }: { label: string; value: string }) { return <div style={{ border: '1px solid rgba(86,160,255,.12)', borderRadius: 10, padding: '12px 13px', background: 'rgba(4,14,27,.35)' }}><span style={labelStyle}>{label}</span><div style={{ ...valueStyle, wordBreak: 'break-word' }}>{value}</div></div>; }
function AccountField({ label, value }: { label: string; value: string }) { return <div><span style={labelStyle}>{label}</span><div style={valueStyle}>{value}</div></div>; }
function formatLicenseDate(value?: string) { if (!value) return 'Renews with subscription'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
function maskIdentifier(value?: string) { if (!value) return 'Available'; return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value; }
function titleCase(value: string) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : value; }
function entitlementMessage(reason: string) { if (reason === 'no_purchase') return 'No TenantIQ purchase was found for this email address.'; if (reason === 'inactive') return 'The TenantIQ subscription associated with this account is not active.'; if (reason === 'not_fulfilled') return 'The subscription exists, but TenantIQ fulfillment has not completed yet.'; if (reason === 'stripe_unavailable') return 'TenantIQ could not verify subscription status right now. Please try again shortly.'; return 'TenantIQ could not confirm an active entitlement for this account.'; }
function Notice({ text, error = false }: { text: string; error?: boolean }) { return <div style={{ marginBottom: 18, border: `1px solid ${error ? 'rgba(248,113,113,.28)' : 'rgba(74,222,128,.25)'}`, background: error ? 'rgba(248,113,113,.08)' : 'rgba(74,222,128,.08)', color: error ? '#fca5a5' : '#86efac', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{text}</div>; }

const cardStyle = { border: '1px solid rgba(86,160,255,.2)', borderRadius: 16, background: 'rgba(8,22,40,.68)', padding: 22 };
const headingStyle = { margin: '0 0 16px', fontSize: 22 };
const eyebrowStyle = { color: '#6eb5ff', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' as const };
const labelStyle = { display: 'block', color: '#7f8b9a', fontSize: 12, fontWeight: 700, marginBottom: 4 };
const valueStyle = { color: '#e8eef7', fontSize: 15 };
const monoStyle = { fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace', color: '#91a3b8' };
const fieldLabelStyle = { display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 };
const inputStyle = { border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' };
const primaryButtonStyle = { width: 'fit-content', border: 0, borderRadius: 10, padding: '11px 15px', fontSize: 14, fontWeight: 800, background: '#2b69b8', color: '#fff', cursor: 'pointer' };
const secondaryButtonStyle = { border: '1px solid rgba(86,160,255,.28)', borderRadius: 10, padding: '11px 15px', fontSize: 14, fontWeight: 800, background: 'transparent', color: '#c8ddf7', cursor: 'pointer' };
const primaryLinkStyle = { display: 'inline-block', borderRadius: 9, padding: '9px 13px', background: '#2b69b8', color: '#fff', textDecoration: 'none', fontWeight: 800 };
