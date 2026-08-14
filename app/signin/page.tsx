import { signIn } from '../../auth';

export default function SignInPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg,#07111f 0%,#0d1321 100%)', color: '#f3f6fb', padding: 24 }}>
      <section style={{ width: 'min(460px,100%)', border: '1px solid rgba(86,160,255,.22)', borderRadius: 20, background: 'rgba(8,22,40,.82)', padding: 32, boxShadow: '0 24px 70px rgba(0,0,0,.28)' }}>
        <div style={{ color: '#6eb5ff', fontSize: 12, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>TenantIQ</div>
        <h1 style={{ margin: '10px 0 10px', fontSize: 34, lineHeight: 1.1 }}>Sign in to your TenantIQ workspace</h1>
        <p style={{ margin: '0 0 22px', color: '#aeb8c8', lineHeight: 1.6 }}>
          Access your TenantIQ assessments and knowledge assistant. A Microsoft 365 subscription is not required to use TenantIQ.
        </p>

        <div style={{ border: '1px solid rgba(86,160,255,.16)', borderRadius: 14, padding: 16, background: 'rgba(86,160,255,.04)', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>TenantIQ account access</div>
          <div style={{ color: '#95a3b5', fontSize: 14, lineHeight: 1.55 }}>
            TenantIQ account sign-in is the primary workspace identity. Microsoft sign-in is optional and can be connected later for organizations that want it.
          </div>
        </div>

        <form
          action={async () => {
            'use server';
            await signIn('microsoft-entra-id', { redirectTo: '/assistant' });
          }}
        >
          <button type="submit" style={{ width: '100%', border: '1px solid rgba(86,160,255,.28)', borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 800, background: 'transparent', color: '#c8ddf7', cursor: 'pointer' }}>
            Optional: continue with Microsoft
          </button>
        </form>

        <p style={{ margin: '16px 0 0', color: '#748093', fontSize: 12, lineHeight: 1.5 }}>
          Local development continues to use the TenantIQ local development identity until the standalone TenantIQ account provider is enabled.
        </p>
      </section>
    </main>
  );
}
