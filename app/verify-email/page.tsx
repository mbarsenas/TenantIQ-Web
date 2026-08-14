import { consumeEmailVerificationToken } from '../../lib/tenantiq-users';

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = String(params.token || '');
  const verified = token ? await consumeEmailVerificationToken(token) : false;

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: 24 }}>
      <section style={{ width: 'min(460px,100%)', border: '1px solid rgba(86,160,255,.22)', borderRadius: 20, background: 'rgba(8,22,40,.82)', padding: 32 }}>
        <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ</div>
        <h1 style={{ margin: '10px 0 10px', fontSize: 32 }}>{verified ? 'Email verified' : 'Verification link unavailable'}</h1>
        <p style={{ color: '#aeb8c8', lineHeight: 1.6 }}>
          {verified ? 'Your TenantIQ email address has been verified. You can now sign in.' : 'This verification link is invalid, expired, or has already been used.'}
        </p>
        <a href="/signin" style={{ display: 'inline-block', marginTop: 12, color: '#6eb5ff', fontWeight: 800 }}>Continue to sign in</a>
      </section>
    </main>
  );
}
