import Link from 'next/link';
import {
  AgingChip,
  Card,
  DonutChart,
  HeatMeter,
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
    jobs
      .filter((j) => j.heatBand === 'hot' || j.heatBand === 'critical')
      .map((j) => j.rep?.id),
  ).size;

  const topThree = [...jobs].sort((a, b) => b.heatScore - a.heatScore).slice(0, 3);

  const briefing = composeBriefing({
    critical: critical.length,
    hot: hot.length,
    fellThrough: fellThrough.length,
    topJob: topThree[0],
  });

  const heatBands = [
    {
      label: 'Cool',
      value: jobs.filter((j) => j.heatBand === 'cool').length,
      color: 'var(--color-heat-cool)',
      tooltip:
        'Heat 0–25. On track. Recent installs, low balance relative to the customer\'s terms, no anomaly flags. No action needed.',
    },
    {
      label: 'Warm',
      value: jobs.filter((j) => j.heatBand === 'warm').length,
      color: 'var(--color-heat-warm)',
      tooltip:
        "Heat 26–50. Visible on the dashboard but not nudged yet. The rep should be aware these exist; I'll watch them.",
    },
    {
      label: 'Hot',
      value: hot.length,
      color: 'var(--color-heat-hot)',
      tooltip:
        "Heat 51–75. I'll draft a follow-up email for the rep today. Combination of past-terms days, balance size, rep silence, and anomalies has crossed into 'nudge' territory.",
    },
    {
      label: 'Critical',
      value: critical.length,
      color: 'var(--color-heat-critical)',
      tooltip:
        'Heat 76+. These automatically flow to the Executive Review Queue — they need a personal touch from the office, not just a rep email.',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <section className="space-y-3 vera-rise">
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">Today&apos;s briefing</h1>
        <VeraQuote>{briefing}</VeraQuote>
      </section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 vera-rise-delay-1">
        <MetricTile
          label="Total AR"
          value={formatUSD(totalAR)}
          hint={`${jobs.length} jobs`}
          tooltip={`Total outstanding balance across the ${jobs.length} jobs that are installed and still owe money. Pre-install jobs and jobs marked exclude_from_qb are excluded.`}
        />
        <MetricTile
          label="Critical"
          value={critical.length}
          hint="Executive review queue"
          emphasis="critical"
          tooltip="Heat 76+. These auto-flow to the Executive Review Queue — too far gone for a rep nudge, needs a personal touch from the office."
        />
        <MetricTile
          label="Hot"
          value={hot.length}
          hint="Vera will draft today"
          emphasis="accent"
          tooltip="Heat 51–75. Vera will draft a follow-up email to the rep today. The rep chases the customer; you stay out of it."
        />
        <MetricTile
          label="Fell through"
          value={fellThrough.length}
          hint={`${repsWithHeat} reps with heat`}
          tooltip="Completed installs with no recent activity — no paperwork, no commission request, no edits in the last 14 days. The 'forgotten' jobs that quietly leak revenue. Updated weekly."
        />
      </section>

      <section className="vera-rise-delay-2">
        <Card>
          <div className="space-y-1">
            <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
              Heat distribution
            </h2>
            <p className="text-text-muted text-xs">
              How the {jobs.length} active AR jobs split across the four heat bands today.
            </p>
          </div>
          <div className="mt-6 flex justify-center sm:justify-start">
            <DonutChart
              data={heatBands}
              size={200}
              thickness={22}
              centerLabel="In AR"
              centerValue={jobs.length.toString()}
              format={(n) => `${n} ${n === 1 ? 'job' : 'jobs'}`}
            />
          </div>
        </Card>
      </section>

      <section className="space-y-4 vera-rise-delay-3">
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
              <div className="flex flex-wrap items-start justify-between gap-8">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-display truncate text-xl tracking-tight">
                    {job.address}
                  </p>
                  <p className="text-text-secondary text-sm">
                    {job.rep?.name ?? 'Unassigned'} · {job.region ?? '—'}
                    {job.isInsurance ? ' · Insurance' : ' · Retail'}
                  </p>
                  <p className="font-display text-text-primary mt-3 text-2xl tracking-tight tabular-nums">
                    {formatUSD(job.balance)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <AgingChip bucket={job.agingBucket} />
                  <HeatMeter
                    score={job.heatScore}
                    band={job.heatBand}
                    breakdown={job.heatBreakdown}
                    variant="compact"
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
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
      : ` And ${fellThrough} ${
          fellThrough === 1 ? 'job seems to' : 'jobs seem to'
        } have fallen through cracks since the last sweep — worth a look this week.`;

  return opener + middle + top + tail;
}
