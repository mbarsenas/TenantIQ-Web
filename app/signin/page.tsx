import { signIn } from '../../auth';

export default function SignInPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: 24 }}>
      <section style={{ width: 'min(460px,100%)', border: '1px solid rgba(86,160,255,.22)', borderRadius: 20, background: 'rgba(8,22,40,.82)', padding: 32, boxShadow: '0 24px 70px rgba(0,0,0,.28)' }}>
        <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ</div>
        <h1 style={{ margin: '10px 0 10px', fontSize: 34, lineHeight: 1.1 }}>Sign in to your assessment workspace</h1>
        <p style={{ margin: '0 0 24px', color: '#aeb8c8', lineHeight: 1.6 }}>Use your Microsoft account to access TenantIQ assessments assigned to your authenticated customer identity.</p>
        <form
          action={async () => {
            'use server';
            await signIn('microsoft-entra-id', { redirectTo: '/assistant' });
          }}
        >
          <button type="submit" style={{ width: '100%', border: 0, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 800, background: '#2b69b8', color: '#fff', cursor: 'pointer' }}>
            Continue with Microsoft
          </button>
        </form>
      </section>
    </main>
  );
}
