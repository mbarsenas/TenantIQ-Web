import { auth, signOut } from '../auth';

type ActivePage = 'dashboard' | 'assessments' | 'assistant' | 'knowledge' | 'account';

const links: Array<{ href: string; label: string; key: ActivePage }> = [
  { href: '/workspace', label: 'Dashboard', key: 'dashboard' },
  { href: '/assessments', label: 'Assessments', key: 'assessments' },
  { href: '/assistant', label: 'Assistant', key: 'assistant' },
  { href: '/knowledge', label: 'Knowledge', key: 'knowledge' },
  { href: '/account', label: 'Account', key: 'account' },
];

export default async function TenantIQAppNav({ active }: { active?: ActivePage }) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const signedInUser = session.user.name || session.user.email || 'TenantIQ user';

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/signin' });
  }

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50, borderBottom: '1px solid rgba(86,160,255,.15)', background: 'rgba(5,15,28,.94)', backdropFilter: 'blur(14px)' }}>
      <div style={{ width: 'min(1180px,100%)', margin: '0 auto', padding: '12px 20px', display: 'flex', gap: 18, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <a href="/workspace" style={{ color: '#f3f7fc', fontWeight: 900, letterSpacing: '.08em', textDecoration: 'none', fontSize: 14 }}>TENANTIQ</a>
          <nav aria-label="TenantIQ workspace" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {links.map((link) => {
              const selected = active === link.key;
              return (
                <a key={link.key} href={link.href} aria-current={selected ? 'page' : undefined} style={{ padding: '8px 11px', borderRadius: 9, textDecoration: 'none', fontSize: 13, fontWeight: 800, color: selected ? '#d9ebff' : '#93a7bd', background: selected ? 'rgba(47,135,255,.14)' : 'transparent', border: selected ? '1px solid rgba(86,160,255,.24)' : '1px solid transparent' }}>
                  {link.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: '#8fa2b8', fontSize: 12, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Signed in as {signedInUser}</span>
          <form action={handleSignOut}>
            <button type="submit" style={{ border: '1px solid rgba(86,160,255,.24)', borderRadius: 9, padding: '7px 10px', background: 'transparent', color: '#bad8f8', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
