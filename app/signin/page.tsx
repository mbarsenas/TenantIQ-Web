import { AuthError } from 'next-auth';
import { signIn } from '../../auth';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const hasError = Boolean(params.error);

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: 24 }}>
      <section style={{ width: 'min(460px,100%)', border: '1px solid rgba(86,160,255,.22)', borderRadius: 20, background: 'rgba(8,22,40,.82)', padding: 32, boxShadow: '0 24px 70px rgba(0,0,0,.28)' }}>
        <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ</div>
        <h1 style={{ margin: '10px 0 10px', fontSize: 34, lineHeight: 1.1 }}>Sign in to your TenantIQ workspace</h1>
        <p style={{ margin: '0 0 22px', color: '#aeb8c8', lineHeight: 1.6 }}>
          Access your TenantIQ assessments and knowledge assistant. A Microsoft 365 subscription is not required.
        </p>

        {hasError ? (
          <div style={{ marginBottom: 16, border: '1px solid rgba(248,113,113,.28)', background: 'rgba(248,113,113,.08)', color: '#fca5a5', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            The email or password was not accepted.
          </div>
        ) : null}

        <form
          action={async (formData) => {
            'use server';
            try {
              await signIn('tenantiq', {
                email: String(formData.get('email') || ''),
                password: String(formData.get('password') || ''),
                redirectTo: '/assistant',
              });
            } catch (error) {
              if (error instanceof AuthError) {
                await signIn('tenantiq', { redirectTo: '/signin?error=credentials' });
              }
              throw error;
            }
          }}
          style={{ display: 'grid', gap: 12 }}
        >
          <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
            Email
            <input name="email" type="email" autoComplete="email" required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
            Password
            <input name="password" type="password" autoComplete="current-password" required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
          </label>
          <button type="submit" style={{ marginTop: 4, width: '100%', border: 0, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 800, background: '#2b69b8', color: '#fff', cursor: 'pointer' }}>
            Sign in to TenantIQ
          </button>
        </form>

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

        <p style={{ margin: '16px 0 0', color: '#748093', fontSize: 12, lineHeight: 1.5 }}>
          Native TenantIQ accounts are configured by the TenantIQ service. Microsoft sign-in remains optional.
        </p>
      </section>
    </main>
  );
}
