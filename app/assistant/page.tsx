import { redirect } from 'next/navigation';
import TenantIQAssistant from '../../components/TenantIQAssistant';
import { auth, signOut } from '../../auth';

async function handleSignOut(): Promise<void> {
  'use server';
  await signOut({ redirectTo: '/signin' });
}

export default async function AssistantPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/signin');
  }

  const signedInUser: string = user.name || user.email || 'TenantIQ user';

  return (
    <>
      <div style={{ position: 'fixed', top: 18, right: 22, zIndex: 30, display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid rgba(86,160,255,.18)', borderRadius: 12, background: 'rgba(8,22,40,.92)', backdropFilter: 'blur(12px)' }}>
        <a href="/account" style={{ color: '#9fb2c8', fontSize: 12, textDecoration: 'none' }}>Signed in as {signedInUser}</a>
        <a href="/account" style={{ border: '1px solid rgba(86,160,255,.22)', borderRadius: 9, padding: '7px 10px', color: '#b9d8ff', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>Account</a>
        <form action={handleSignOut}>
          <button type="submit" style={{ border: '1px solid rgba(86,160,255,.28)', borderRadius: 9, padding: '7px 10px', background: 'transparent', color: '#c8ddf7', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            Sign out
          </button>
        </form>
      </div>
      <TenantIQAssistant signedInUser={signedInUser} />
    </>
  );
}
