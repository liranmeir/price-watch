import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

/**
 * This is a single-user (or small-household) personal tool, not a
 * multi-tenant app — there's no ProjectMember/organization model. Access
 * is gated by an email allowlist instead: only the addresses in
 * ALLOWED_EMAILS (comma-separated) can sign in. Session uses JWTs, so no
 * NextAuth User/Session tables are needed in the schema.
 */
function allowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      const allowlist = allowedEmails();
      if (allowlist.length === 0) {
        // Fail closed: an empty allowlist means nobody can sign in rather
        // than accidentally leaving the app open to any Google account.
        return false;
      }
      return Boolean(user.email && allowlist.includes(user.email.toLowerCase()));
    },
  },
  pages: {
    signIn: '/login',
  },
};
