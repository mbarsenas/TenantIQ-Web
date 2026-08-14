import { redirect } from 'next/navigation';
import { createUser, findUserByEmail } from '../../lib/tenantiq-users';
import { signIn } from '../../auth';

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;

  async function register(formData: FormData) {
    'use server';

    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');

    if (!name || !email || password.length < 12) {
      redirect('/signup?error=invalid');
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      redirect('/signup?error=exists');
    }

    await createUser({ name, email, password });

    const result = await signIn('tenantiq', {
      email,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      redirect('/signin');
    }

    redirect('/assistant');
  }

  const message =
    error === 'exists'
      ? 'An account already exists for that email address.'
      : error === 'invalid'
        ? 'Enter your name, a valid email address, and a password of at least 12 characters.'
        : null;

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: 24 }}>
      <section style={{ width: 'min(460px,100%)', border: '1px solid rgba(86,160,255,.22)', borderRadius: 20, background: 'rgba(8,22,40,.82)', padding: 32, boxShadow: '0 24px 70px rgba(0,0,0,.28)' }}>
        <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ</div>
        <h1 style={{ margin: '10px 0 10px', fontSize: 34, lineHeight: 1.1 }}>Create your TenantIQ account</h1>
        <p style={{ margin: '0 0 22px', color: '#aeb8c8', lineHeight: 1.6 }}>
          Create a persistent TenantIQ account for your assessment workspace. Microsoft 365 is not required.
        </p>

        {message ? (
          <div style={{ marginBottom: 16, border: '1px solid rgba(248,113,113,.28)', background: 'rgba(248,113,113,.08)', color: '#fca5a5', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
            {message}
          </div>
        ) : null}

        <form action={register} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
            Name
            <input name="name" type="text" autoComplete="name" required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
            Email
            <input name="email" type="email" autoComplete="email" required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
          </label>
          <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={12} required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
          </label>
          <div style={{ color: '#748093', fontSize: 12 }}>Use at least 12 characters.</div>
          <button type="submit" style={{ marginTop: 4, width: '100%', border: 0, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 800, background: '#2b69b8', color: '#fff', cursor: 'pointer' }}>
            Create TenantIQ account
          </button>
        </form>

        <p style={{ margin: '18px 0 0', color: '#95a3b5', fontSize: 13 }}>
          Already have an account? <a href="/signin" style={{ color: '#6eb5ff', fontWeight: 700 }}>Sign in</a>
        </p>
      </section>
    </main>
  );
}
