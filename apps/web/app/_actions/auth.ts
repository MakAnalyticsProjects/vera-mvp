'use server';

import { signOut } from '@/lib/auth';

/**
 * Server action that runs Auth.js's signOut() and redirects to the landing
 * page. Used by the SidebarNav "Log out" button. Server actions handle the
 * CSRF token + cookie cleanup that a raw POST form to /api/auth/signout
 * doesn't.
 */
export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
