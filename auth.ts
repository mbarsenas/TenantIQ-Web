import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID?.trim();
const microsoftConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim(),
);

function configuredUsers() {
  const raw = process.env.TENANTIQ_LOCAL_USERS_JSON?.trim();
  if (!raw) return [] as Array<{ email: string; password: string; name?: string }>;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.email === 'string' && typeof item.password === 'string')
      .map((item) => ({
        email: item.email.trim().toLowerCase(),
        password: item.password,
        name: typeof item.name === 'string' ? item.name.trim() : undefined,
      }));
  } catch {
    return [];
  }
}

const providers = [
  Credentials({
    id: 'tenantiq',
    name: 'TenantIQ',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    authorize: async (credentials) => {
      const email = String(credentials?.email || '').trim().toLowerCase();
      const password = String(credentials?.password || '');
      if (!email || !password) return null;

      const user = configuredUsers().find((candidate) => candidate.email === email && candidate.password === password);
      if (!user) return null;

      return {
        id: `tenantiq:${user.email}`,
        email: user.email,
        name: user.name || user.email,
      };
    },
  }),
];

if (microsoftConfigured) {
  providers.push(
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: tenantId ? `https://login.microsoftonline.com/${tenantId}/v2.0` : undefined,
    }) as never,
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: {
    signIn: '/signin',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user, profile, account }) {
      if (user?.id) token.userId = user.id;
      if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;

      if (profile && account?.provider === 'microsoft-entra-id') {
        const oid = typeof profile.oid === 'string' ? profile.oid : undefined;
        const tid = typeof profile.tid === 'string' ? profile.tid : tenantId;
        const email =
          typeof profile.preferred_username === 'string'
            ? profile.preferred_username
            : typeof profile.email === 'string'
              ? profile.email
              : token.email;

        if (oid) token.userId = oid;
        if (tid) token.tid = tid;
        if (email) token.email = email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.userId === 'string' ? token.userId : token.sub || '';
        session.user.tenantId = typeof token.tid === 'string' ? token.tid : '';
      }
      return session;
    },
  },
});
