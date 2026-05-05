import Link from 'next/link';
import {
  AgingChip,
  Card,
  HeatScoreBadge,
  MetricTile,
  VeraQuote,
} from '@vera/ui';
import { formatUSD } from '@vera/utils';
import { getData } from '@/lib/data';

export default function DashboardOverview() {
  const { jobs, totalAR } = getData();

  const critical = jobs.filter((j) => j.heatBand === 'critical');
  const hot = jobs.filter((j) => j.heatBand === 'hot');
  const fellThrough = jobs.filter((j) => j.fellThroughCracks);
  const repsWithHeat = new Set(
    jobs.filter((j) => j.heatBand === 'hot' || j.heatBand === 'critical').map((j) => j.rep?.id),
  ).size;

  const topThree = [...jobs]
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 3);

  const briefing = composeBriefing({
    critical: critical.length,
    hot: hot.length,
    fellThrough: fellThrough.length,
    topJob: topThree[0],
  });

  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <section className="space-y-3">
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">Today&apos;s briefing</h1>
        <VeraQuote>{briefing}</VeraQuote>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTile label="Total AR" value={formatUSD(totalAR)} hint={`${jobs.length} jobs`} />
        <MetricTile
          label="Critical"
          value={critical.length}
          hint="Executive review queue"
          emphasis="critical"
        />
        <MetricTile
          label="Hot"
          value={hot.length}
          hint="Vera will draft today"
          emphasis="accent"
        />
        <MetricTile
          label="Fell through"
          value={fellThrough.length}
          hint={`${repsWithHeat} reps with heat`}
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
              Top three I&apos;d look at first
            </h2>
            <Link
              href="/dashboard/follow-ups"
              className="text-accent text-sm hover:underline"
            >
              See all follow-ups →
            </Link>
          </div>
          <div className="space-y-3">
            {topThree.map((job) => (
              <Card key={job.id} className="!py-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-display truncate text-xl tracking-tight">
                      {job.address}
                    </p>
                    <p className="text-text-secondary text-sm">
                      {job.rep?.name ?? 'Unassigned'} · {job.region ?? '—'}
                      {job.isInsurance ? ' · Insurance' : ' · Retail'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="font-display text-2xl tracking-tight tabular-nums">
                      {formatUSD(job.balance)}
                    </p>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <AgingChip bucket={job.agingBucket} />
                      <HeatScoreBadge
                        score={job.heatScore}
                        band={job.heatBand}
                        breakdown={job.heatBreakdown}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <aside className="space-y-3">
          <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
            How I&apos;m thinking about this
          </h2>
          <Card className="space-y-4 !py-6 text-sm">
            <Default qNum="Q1" label="AR working set">
              Only jobs with an install date and a balance &gt; 0 — about 130 records out of
              the 103,440 in RoofLink.
            </Default>
            <Default qNum="Q3" label="Net terms">
              Net 30 for retail / cash. Net 60 for insurance jobs (depreciation timeline).
            </Default>
            <Default qNum="Q4" label="Aging buckets">
              Relative to terms, not the calendar — so a 50-day insurance job is on time.
            </Default>
            <Default qNum="Q7" label="Heat score">
              0–100 with a 4-component breakdown — hover any heat badge to see the math.
            </Default>
            <Default qNum="Q9" label="Email behavior">
              I draft only. Nothing leaves your control until you copy or click&nbsp;send.
            </Default>
            <p className="text-text-muted pt-2 text-xs">
              Full reasoning in <code className="font-mono text-xs">DISCUSSION.md</code>.
            </p>
          </Card>
        </aside>
      </section>
    </div>
  );
}

function Default({
  qNum,
  label,
  children,
}: {
  qNum: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs">
        <span className="text-accent font-medium tracking-wider">{qNum}</span>
        <span className="text-text-primary ml-2 font-medium">{label}</span>
      </p>
      <p className="text-text-secondary leading-relaxed">{children}</p>
    </div>
  );
}

function composeBriefing({
  critical,
  hot,
  fellThrough,
  topJob,
}: {
  critical: number;
  hot: number;
  fellThrough: number;
  topJob: { address: string; rep: { name: string } | null } | undefined;
}): string {
  const opener =
    critical === 0
      ? 'Good morning. The critical queue is clear today, which is rare and worth noticing.'
      : `Good morning. ${critical} ${critical === 1 ? 'job is' : 'jobs are'} in the critical band — the executive review queue is where I'd start.`;

  const middle =
    hot === 0
      ? ''
      : ` ${hot} more ${hot === 1 ? 'is' : 'are'} hot enough that I'll draft follow-ups for the reps today.`;

  const top = topJob
    ? ` Right now ${topJob.address} is at the top of my list${
        topJob.rep ? ` — that's ${topJob.rep.name}'s` : ''
      }.`
    : '';

  const tail =
    fellThrough === 0
      ? ''
      : ` And ${fellThrough} ${fellThrough === 1 ? 'job seems to' : 'jobs seem to'} have fallen through cracks since the last sweep — worth a look this week.`;

  return opener + middle + top + tail;
}
