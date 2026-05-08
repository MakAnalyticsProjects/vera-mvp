import { redirect } from 'next/navigation';
import { signIn, auth } from '@/lib/auth';
import { Button, VeraAvatar } from '@vera/ui';

/**
 * Login page. Server component — checks if the user is already signed in
 * (and redirects to dashboard if so), otherwise renders the Google sign-in
 * button. The button is wired through a server action so we don't need to
 * pull next-auth's client helpers into a client component for this single
 * action.
 */

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? '/dashboard';

  // Only redirect if there's a real signed-in user. Auth.js v5 sometimes
  // returns a stub session shape; guard on the email field.
  if (session?.user?.email) {
    redirect(callbackUrl);
  }

  async function handleSignIn() {
    'use server';
    await signIn('google', { redirectTo: callbackUrl });
  }

  return (
    <main className="bg-bg-base flex min-h-screen items-center justify-center px-6">
      <div className="bg-bg-card border-border vera-modal-in flex w-full max-w-md flex-col items-center gap-6 rounded-[var(--radius-card)] border p-10 text-center shadow-2xl">
        <VeraAvatar size="lg" />
        <div className="space-y-2">
          <p className="text-text-muted text-[0.65rem] tracking-[0.25em] uppercase">
            Vera Calloway · AI Studio
          </p>
          <h1 className="font-display text-3xl tracking-tight">Welcome back.</h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            Sign in with Google to access today&apos;s briefing, your AR pipeline,
            and the schedule of who Vera follows up with on your behalf.
          </p>
        </div>
        <form action={handleSignIn} className="w-full">
          <Button type="submit" size="lg" className="w-full justify-center">
            <GoogleIcon className="mr-2 h-4 w-4" />
            Sign in with Google
          </Button>
        </form>
        <p className="text-text-muted text-[0.65rem]">
          By signing in you agree to use this dashboard for AR ops only.
        </p>
      </div>
    </main>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
