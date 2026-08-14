import { redirect } from 'next/navigation';
import { createAuthToken, findUserByEmail } from '../../lib/tenantiq-users';
import { sendPasswordResetEmail } from '../../lib/tenantiq-email';

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const params = await searchParams;
  const sent = params.sent === '1';

  async function requestReset(formData: FormData) {
    'use server';
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const user = email ? await findUserByEmail(email) : null;

    if (user) {
      const token = await createAuthToken(String(user.id), 'reset-password', 60);
      const delivered = await sendPasswordResetEmail(String(user.email), token);
      if (!delivered && process.env.NODE_ENV !== 'production') {
        console.log(`[TenantIQ] Password reset URL: ${(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')}/reset-password?token=${token}`);
      }
    }

    redirect('/forgot-password?sent=1');
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: 24 }}>
      <section style={{ width: 'min(460px,100%)', border: '1px solid rgba(86,160,255,.22)', borderRadius: 20, background: 'rgba(8,22,40,.82)', padding: 32 }}>
        <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ</div>
        <h1 style={{ margin: '10px 0 10px', fontSize: 32 }}>Reset your password</h1>
        <p style={{ color: '#aeb8c8', lineHeight: 1.6 }}>Enter your TenantIQ account email. If the account exists, we’ll send a password reset link.</p>
        {sent ? <div style={{ marginBottom: 16, border: '1px solid rgba(74,222,128,.25)', background: 'rgba(74,222,128,.08)', color: '#86efac', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>If an account exists for that email, a reset link has been sent.</div> : null}
        <form action={requestReset} style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'grid', gap: 6, color: '#cbd7e7', fontSize: 13, fontWeight: 700 }}>
            Email
            <input name="email" type="email" autoComplete="email" required style={{ border: '1px solid rgba(86,160,255,.26)', borderRadius: 10, background: '#081425', color: '#f3f6fb', padding: '12px 13px', outline: 'none' }} />
          </label>
          <button type="submit" style={{ width: '100%', border: 0, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 800, background: '#2b69b8', color: '#fff', cursor: 'pointer' }}>Send reset link</button>
        </form>
        <a href="/signin" style={{ display: 'inline-block', marginTop: 18, color: '#6eb5ff', fontWeight: 700 }}>Back to sign in</a>
      </section>
    </main>
  );
}
