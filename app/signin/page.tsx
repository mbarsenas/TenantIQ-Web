import { redirect } from 'next/navigation';
import { signIn } from '../../auth';
import { findUserByEmail } from '../../lib/tenantiq-users';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const params = await searchParams;
  const created = params.created === '1';
  const error = params.error;
  const microsoftConfigured = Boolean(
    process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim(),
  );

  async function signInWithTenantIQ(formData: FormData) {
    'use server';

    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');

    const row = email ? await findUserByEmail(email) : null;
    if (row && !row.email_verified) {
      redirect('/signin?error=verify');
    }

    const result = await signIn('tenantiq', {
      email,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      redirect('/signin?error=credentials');
    }

    redirect('/assistant');
  }

  const errorMessage =
    error === 'verify'
      ? 'Verify your email before signing in. Use the verification link TenantIQ sent to your inbox.'
      : error
        ? 'The email or password was not accepted.'
        : null;

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: 24 }}>
      <section style={{ width: 'min(460px,100%)', border: '1px solid rgba(86,160,255,.22)', borderRadius: 20, background: 'rgba(8,22,40,.82)', padding: 32, boxShadow: '0 24px 70px rgba(0,0,0,.28)' }}>
        <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ</div>
        <h1 style={{ margin: '10px 0 10px', fontSize: 34, lineHeight: 1.1 }}>Sign in to your TenantIQ workspace</h1>
        <p style={{ margin: '0 0 22px', color: '#aeb8c8', lineHeight: 1.6 }}>
          Access your TenantIQ assessments and knowledge assistant. A Microsoft 365 subscription is not required.
        </p>

        {created ? (
          <div style={{ marginBottom: 16, border: '1px solid rgba(74,222,128,.25)', background: 'rgba(74,222,128,.08)', color: '#86efac', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            Your account was created. Check your email for the verification link before signing in.
          </div>
        ) : null}

        {errorMessage ? (
          <div style={{ marginBottom: 16, border: '1px solid rgba(248,113,113,.28)', background: 'rgba(248,113,113,.08)', color: '#fca5a5', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            {errorMessage}
          </div>
        ) : null}

        <form action={signInWithTenantIQ} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
            Email
            <input name="email" type="email" autoComplete="email" required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
            Password
            <input name="password" type="password" autoComplete="current-password" required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
          </label>
          <div style={{ textAlign: 'right', marginTop: -4 }}>
            <a href="/forgot-password" style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 700 }}>Forgot password?</a>
          </div>
          <button type="submit" style={{ marginTop: 4, width: '100%', border: 0, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 800, background: '#2b69b8', color: '#fff', cursor: 'pointer' }}>
            Sign in to TenantIQ
          </button>
        </form>

        <p style={{ margin: '16px 0 0', color: '#95a3b5', fontSize: 13 }}>
          New to TenantIQ? <a href="/signup" style={{ color: '#6eb5ff', fontWeight: 700 }}>Create an account</a>
        </p>

        {microsoftConfigured ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '22px 0 16px', color: '#66768a', fontSize: 12 }}>
              <span style={{ height: 1, background: 'rgba(86,160,255,.16)', flex: 1 }} />
              Optional
              <span style={{ height: 1, background: 'rgba(86,160,255,.16)', flex: 1 }} />
            </div>

            <form
              action={async () => {
                'use server';
                await signIn('microsoft-entra-id', { redirectTo: '/assistant' });
              }}
            >
              <button type="submit" style={{ width: '100%', border: '1px solid rgba(86,160,255,.28)', borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 800, background: 'transparent', color: '#c8ddf7', cursor: 'pointer' }}>
                Continue with Microsoft
              </button>
            </form>
          </>
        ) : null}
      </section>
    </main>
  );
}
