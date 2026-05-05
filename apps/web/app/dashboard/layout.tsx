import Link from 'next/link';
import {
  AlertTriangle,
  ClipboardCheck,
  GaugeCircle,
  Home,
  ListChecks,
  MessageCircle,
  Trophy,
} from 'lucide-react';
import { getData } from '@/lib/data';
import { ChatPanel } from './_components/ChatPanel';

const NAV = [
  { href: '/dashboard', label: 'Today', icon: Home },
  { href: '/dashboard/aging', label: 'Aging & anomalies', icon: AlertTriangle },
  { href: '/dashboard/milestones', label: 'Milestones', icon: ListChecks },
  { href: '/dashboard/follow-ups', label: 'Follow-ups', icon: GaugeCircle },
  { href: '/dashboard/rep-report', label: 'Rep outstanding', icon: Trophy },
  { href: '/dashboard/reconciliation', label: 'Reconciliation', icon: ClipboardCheck },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { asOf } = getData();
  const asOfDate = new Date(asOf).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-bg-base min-h-screen">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="border-border bg-bg-card hidden w-60 flex-shrink-0 border-r md:flex md:flex-col">
          <Link href="/" className="border-border block border-b px-6 py-6">
            <p className="text-text-muted text-[0.65rem] tracking-[0.25em] uppercase">
              Vera Calloway
            </p>
            <p className="font-display mt-1 text-2xl tracking-tight">AR Studio</p>
          </Link>
          <nav className="flex flex-1 flex-col gap-1 px-3 py-6">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="text-text-secondary hover:bg-bg-base hover:text-text-primary flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="border-border border-t px-6 py-5">
            <p className="text-text-muted flex items-center gap-2 text-xs">
              <MessageCircle className="h-3 w-3" />
              <span>Chat opens bottom-right →</span>
            </p>
          </div>
        </aside>

        {/* Main */}
        <div className="min-w-0 flex-1">
          <header className="border-border bg-bg-base/80 sticky top-0 z-10 flex items-center justify-between border-b px-8 py-5 backdrop-blur">
            <div>
              <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
                Briefing for
              </p>
              <p className="font-display text-xl tracking-tight">{asOfDate}</p>
            </div>
            <div className="text-text-secondary text-sm italic">
              Vera is watching · 130 jobs in AR
            </div>
          </header>
          <div className="px-8 py-10">{children}</div>
        </div>
      </div>
      <ChatPanel />
    </div>
  );
}
