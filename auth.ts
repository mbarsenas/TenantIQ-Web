import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { verifyUserPassword } from './lib/tenantiq-users';

const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID?.trim();
const microsoftConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim(),
);

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

      const user = await verifyUserPassword(email, password);
      if (!user || !user.emailVerified) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: true,
      } as never;
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
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers,
  pages: {
    signIn: '/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 30,
  },
  jwt: {
    maxAge: 60 * 60 * 8,
  },
  callbacks: {
    async jwt({ token, user, profile, account }) {
      if (user?.id) token.userId = user.id;
      if (user?.email) token.email = user.email;
      if (user?.name) token.name = user.name;
      if ((user as { emailVerified?: boolean } | undefined)?.emailVerified) token.emailVerified = true;

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
        token.emailVerified = true;
      }
      return token;
    },
    async session({ session, token }) {
      const sessionUser = session.user as unknown as {
        id?: string;
        tenantId?: string;
        emailVerified?: boolean;
      };

      sessionUser.id = typeof token.userId === 'string' ? token.userId : token.sub || '';
      sessionUser.tenantId = typeof token.tid === 'string' ? token.tid : '';
      sessionUser.emailVerified = token.emailVerified === true;

      return session;
    },
  },
});
