import type { Metadata } from 'next';
import Link from 'next/link';
import { VeraAvatar } from '@vera/ui';
import { getDataForCurrentSession } from '@/lib/data';
import { auth } from '@/lib/auth';
import { AsOfDate } from './_components/AsOfDate';
import { ChatPanel } from './_components/ChatPanel';
import { MobileNav } from './_components/MobileNav';
import { SidebarNav } from './_components/SidebarNav';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { asOf } = await getDataForCurrentSession();
  const session = await auth();
  const firstName = session?.user?.name?.split(' ')[0] ?? null;

  return (
    <div className="bg-bg-base min-h-screen">
      {/* Fixed sidebar */}
      <aside className="border-border bg-bg-card fixed top-0 left-0 z-20 hidden h-screen w-60 flex-col border-r md:flex">
        <Link
          href="/"
          className="border-border flex h-[84px] items-center gap-3 border-b px-6"
        >
          <VeraAvatar size="md" />
          <div>
            <p className="text-text-muted text-[0.65rem] tracking-[0.25em] uppercase">
              Vera Calloway
            </p>
            <p className="font-display mt-1 text-2xl tracking-tight leading-none">
              AI Studio
            </p>
          </div>
        </Link>
        <SidebarNav />
      </aside>

      {/* Main content */}
      <div className="md:ml-60">
        <header className="border-border bg-bg-base/85 sticky top-0 z-10 flex h-[84px] items-center justify-between gap-3 border-b px-4 backdrop-blur sm:px-6 md:px-8">
          <div className="min-w-0">
            <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
              {firstName ? `Briefing for ${firstName}` : 'Briefing for'}
            </p>
            <p className="font-display mt-1 truncate text-lg tracking-tight leading-none sm:text-xl">
              <AsOfDate asOf={asOf} />
            </p>
          </div>
          <MobileNav />
        </header>
        <main className="vera-page-fade px-4 pt-8 pb-32 sm:px-6 sm:pt-10 md:px-8">
          {children}
        </main>
      </div>
      <ChatPanel />
    </div>
  );
}
