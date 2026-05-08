import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Protects everything under /dashboard. Unauthenticated requests are
 * redirected to /login with a `?callbackUrl=` so we bounce them back after
 * sign-in.
 *
 * /api/cron/* is protected by CRON_SECRET (separate gate).
 * /api/auth/* is the auth handlers themselves.
 */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  let session = null;
  try {
    session = await auth();
  } catch {
    // Auth not configured (e.g. local dev without secrets) — treat as
    // signed-out and redirect.
  }

  if (!session?.user?.email) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
