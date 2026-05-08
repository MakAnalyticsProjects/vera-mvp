import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';
import { db } from '@/lib/db';

/**
 * Auth.js v5 configuration. Google provider, JWT session strategy (avoids
 * needing a Prisma adapter just yet — sessions live in cookies), with a
 * custom signIn callback that:
 *   - Looks up or auto-creates a `User` row for the signed-in Google account
 *   - Binds it to Priority Roofs Dallas (tenantId=1) for v1 since we're
 *     single-tenant. Future tenants will get added through a team-onboarding
 *     flow, not here.
 *   - Stores the resolved userId, tenantId, and role on the JWT so the
 *     session callback can hand them to the rest of the app.
 *
 * Whitelist policy: open. Any signed-in Google account is admitted on first
 * sign-in. Per IMPROVEMENTS.md §2.4, this is fine for v1; tighten to a
 * domain rule when going wider.
 */

const TENANT_ID_FALLBACK = 1;

// Wrap the destructure so TypeScript infers a non-portable type name from
// our re-exports. Auth.js v5 has known TS inference quirks in monorepo
// workspaces; this pattern sidesteps them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _nextAuth: any = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      // Find or create the user row, bind to default tenant.
      try {
        const existing = await db.user.findUnique({
          where: { email: user.email },
        });
        if (!existing) {
          await db.user.create({
            data: {
              email: user.email,
              name: user.name ?? null,
              imageUrl: user.image ?? null,
              googleSub: account?.providerAccountId ?? null,
              tenantId: TENANT_ID_FALLBACK,
              role: 'member',
            },
          });
        } else if (!existing.googleSub && account?.providerAccountId) {
          await db.user.update({
            where: { id: existing.id },
            data: {
              googleSub: account.providerAccountId,
              name: user.name ?? existing.name,
              imageUrl: user.image ?? existing.imageUrl,
            },
          });
        }
      } catch (e) {
        // DB not yet provisioned — log and let sign-in proceed; the session
        // will lack tenantId until DATABASE_URL is set, but auth still works.
        // eslint-disable-next-line no-console
        console.warn('[auth] user upsert failed:', e);
      }
      return true;
    },
    async jwt({ token, user }) {
      // Refresh tenantId/userId from DB on initial sign-in.
      if (user?.email) {
        try {
          const row = await db.user.findUnique({
            where: { email: user.email },
          });
          if (row) {
            token.userId = row.id;
            token.tenantId = row.tenantId;
            token.role = row.role;
          }
        } catch {
          /* DB not provisioned — leave token without tenantId */
        }
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.userId = token.userId as number | undefined;
        session.user.tenantId = token.tenantId as number | undefined;
        session.user.role = token.role as string | undefined;
      }
      return session;
    },
  },
});

export const handlers = _nextAuth.handlers;
export const signIn: (
  ...args: any[]
) => Promise<unknown> = _nextAuth.signIn;
export const signOut: (
  ...args: any[]
) => Promise<unknown> = _nextAuth.signOut;
export const auth: (
  ...args: any[]
) => Promise<{
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    userId?: number;
    tenantId?: number;
    role?: string;
  };
} | null> = _nextAuth.auth;
