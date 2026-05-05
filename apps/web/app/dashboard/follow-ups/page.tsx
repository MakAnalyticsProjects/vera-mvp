import Link from 'next/link';
import { Card, MetricTile, VeraQuote } from '@vera/ui';
import { formatUSD } from '@vera/utils';
import { getData } from '@/lib/data';
import { FollowUpsList } from './FollowUpsList';

type Tab = 'follow-ups' | 'queue';

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab: Tab = params.tab === 'queue' ? 'queue' : 'follow-ups';

  const { jobs } = getData();
  const hot = jobs.filter((j) => j.heatBand === 'hot').sort((a, b) => b.heatScore - a.heatScore);
  const critical = jobs
    .filter((j) => j.heatBand === 'critical')
    .sort((a, b) => b.heatScore - a.heatScore);

  const visible = tab === 'queue' ? critical : hot;

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <header className="space-y-3 vera-rise">
        <p className="text-text-muted text-xs tracking-[0.2em] uppercase">
          Daily · rep follow-ups & escalation
        </p>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">
          Who I&apos;d nudge today.
        </h1>
        <VeraQuote>
          {tab === 'queue'
            ? `${critical.length} ${
                critical.length === 1 ? 'job is' : 'jobs are'
              } in the executive review queue — these crossed Heat 76 and warrant a personal touch from the office.`
            : `I'll draft for ${hot.length} hot ${
                hot.length === 1 ? 'job' : 'jobs'
              } today. Nothing autosends — open any row and I'll show you the email I'd send.`}
        </VeraQuote>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 vera-rise-delay-1">
        <MetricTile
          label="Hot — for reps"
          value={hot.length}
          hint="Heat 51–75"
          emphasis="accent"
          tooltip="Jobs in the Hot heat band (51–75). Vera will draft a follow-up email to the rep — the rep chases the homeowner / insurance company. You stay out of it."
        />
        <MetricTile
          label="Critical — exec review"
          value={critical.length}
          hint="Heat 76+"
          emphasis="critical"
          tooltip="Jobs in the Critical heat band (76+). Too far gone for a rep nudge — needs a personal touch from the office. Maybe call the homeowner directly, write off, or use as a learning moment for the rep."
        />
        <MetricTile
          label="Total in heat"
          value={hot.length + critical.length}
          tooltip="Sum of Hot and Critical jobs. Cool (0–25) and Warm (26–50) jobs are visible elsewhere on the dashboard but don't get follow-up emails today."
        />
        <MetricTile
          label="Total dollars in heat"
          value={formatUSD([...hot, ...critical].reduce((s, j) => s + j.balance, 0))}
          tooltip="Sum of outstanding balances across all Hot and Critical jobs combined. The dollar exposure on jobs that need active follow-up today."
        />
      </section>

      <div className="border-border flex gap-1 border-b vera-rise-delay-2">
        <TabLink active={tab === 'follow-ups'} href="/dashboard/follow-ups">
          Rep follow-ups · {hot.length}
        </TabLink>
        <TabLink active={tab === 'queue'} href="/dashboard/follow-ups?tab=queue">
          Executive review queue · {critical.length}
        </TabLink>
      </div>

      <section className="vera-rise-delay-3">
        {visible.length === 0 ? (
          <Card>
            <p className="text-text-secondary">
              {tab === 'queue'
                ? 'Executive queue is clear. Nothing has crossed the Critical threshold today.'
                : "Nothing in the Hot band today. Nothing for me to draft."}
            </p>
          </Card>
        ) : (
          <FollowUpsList jobs={visible} />
        )}
      </section>
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={
        active
          ? 'border-accent text-text-primary -mb-px border-b-2 px-5 py-3 text-sm font-medium'
          : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent px-5 py-3 text-sm transition-colors'
      }
    >
      {children}
    </Link>
  );
}
