import NextAuth from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';

const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID?.trim();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: tenantId
        ? `https://login.microsoftonline.com/${tenantId}/v2.0`
        : undefined,
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        const oid = typeof profile.oid === 'string' ? profile.oid : undefined;
        const tid = typeof profile.tid === 'string' ? profile.tid : tenantId;
        const email =
          typeof profile.preferred_username === 'string'
            ? profile.preferred_username
            : typeof profile.email === 'string'
              ? profile.email
              : token.email;

        if (oid) token.oid = oid;
        if (tid) token.tid = tid;
        if (email) token.email = email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.oid === 'string' ? token.oid : token.sub || '';
        session.user.tenantId = typeof token.tid === 'string' ? token.tid : '';
      }
      return session;
    },
  },
});
