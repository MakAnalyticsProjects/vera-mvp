import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

/**
 * Edge-safe middleware. Uses the lightweight auth.config.ts (no DB,
 * no Prisma) so the bundle stays under the 1 MB Edge limit. The full
 * Auth.js setup with DB callbacks lives in lib/auth.ts and runs only
 * in API routes / server components.
 *
 * Protects everything under /dashboard. Unauthenticated requests are
 * redirected to /login with a `?callbackUrl=` so we bounce them back
 * after sign-in.
 */
// Auth.js v5 has TS inference quirks in monorepo workspaces; the cast lets
// us name the export's type without dragging in a non-portable reference.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { auth } = NextAuth(authConfig) as { auth: any };

const middleware = auth((req: { nextUrl: URL; auth?: { user?: { email?: string } }; url: string }) => {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }
  if (!req.auth?.user?.email) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
});

export default middleware;

export const config = {
  matcher: ['/dashboard/:path*'],
};
