import { redirect } from 'next/navigation';
import { resetPasswordWithToken } from '../../lib/tenantiq-users';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string; reset?: string }> }) {
  const params = await searchParams;
  const token = String(params.token || '');
  const error = params.error;
  const reset = params.reset === '1';

  async function resetPassword(formData: FormData) {
    'use server';
    const submittedToken = String(formData.get('token') || '');
    const password = String(formData.get('password') || '');
    const confirm = String(formData.get('confirm') || '');

    if (!submittedToken || password.length < 12 || password !== confirm) {
      redirect(`/reset-password?token=${encodeURIComponent(submittedToken)}&error=invalid`);
    }

    const ok = await resetPasswordWithToken(submittedToken, password);
    if (!ok) {
      redirect('/reset-password?error=expired');
    }

    redirect('/reset-password?reset=1');
  }

  const message =
    error === 'invalid'
      ? 'Passwords must match and contain at least 12 characters.'
      : error === 'expired'
        ? 'This reset link is invalid, expired, or has already been used.'
        : null;

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: 24 }}>
      <section style={{ width: 'min(460px,100%)', border: '1px solid rgba(86,160,255,.22)', borderRadius: 20, background: 'rgba(8,22,40,.82)', padding: 32 }}>
        <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ</div>
        <h1 style={{ margin: '10px 0 10px', fontSize: 32 }}>{reset ? 'Password updated' : 'Choose a new password'}</h1>

        {reset ? (
          <>
            <p style={{ color: '#aeb8c8', lineHeight: 1.6 }}>Your TenantIQ password has been changed successfully.</p>
            <a href="/signin" style={{ display: 'inline-block', marginTop: 12, color: '#6eb5ff', fontWeight: 800 }}>Continue to sign in</a>
          </>
        ) : (
          <>
            {message ? <div style={{ marginBottom: 16, border: '1px solid rgba(248,113,113,.28)', background: 'rgba(248,113,113,.08)', color: '#fca5a5', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{message}</div> : null}
            {!token && error !== 'expired' ? <div style={{ marginBottom: 16, color: '#fca5a5', fontSize: 13 }}>A password reset token is required.</div> : null}
            {token ? (
              <form action={resetPassword} style={{ display: 'grid', gap: 12 }}>
                <input type="hidden" name="token" value={token} />
                <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
                  New password
                  <input name="password" type="password" autoComplete="new-password" minLength={12} required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
                </label>
                <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
                  Confirm password
                  <input name="confirm" type="password" autoComplete="new-password" minLength={12} required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
                </label>
                <button type="submit" style={{ width: '100%', border: 0, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 800, background: '#2b69b8', color: '#fff', cursor: 'pointer' }}>Update password</button>
              </form>
            ) : null}
            <a href="/forgot-password" style={{ display: 'inline-block', marginTop: 18, color: '#6eb5ff', fontWeight: 700 }}>Request a new reset link</a>
          </>
        )}
      </section>
    </main>
  );
}
