import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * Edge-safe Auth.js config. Imported by middleware.ts so we never pull
 * Prisma into the Edge runtime bundle (it would push us past 1 MB).
 *
 * The full config in lib/auth.ts spreads this and adds the DB-touching
 * signIn / jwt / session callbacks.
 */
export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
};
