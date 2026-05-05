import {
  AgingChip,
  Card,
  HeatScoreBadge,
  MetricTile,
  MissingStepTag,
  VeraQuote,
} from '@vera/ui';
import { formatUSD } from '@vera/utils';
import { generateFollowUpDraft } from '@vera/domain';
import type { ARJob } from '@vera/types';
import { getData } from '@/lib/data';
import { DraftEmailButton } from './DraftEmailButton';

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
      <header className="space-y-3">
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
            : `I&apos;ll draft for ${hot.length} hot ${
                hot.length === 1 ? 'job' : 'jobs'
              } today. Nothing autosends — open any row and I&apos;ll show you the email I&apos;d send.`}
        </VeraQuote>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTile
          label="Hot — for reps"
          value={hot.length}
          hint="Heat 51–75"
          emphasis="accent"
        />
        <MetricTile
          label="Critical — exec review"
          value={critical.length}
          hint="Heat 76+"
          emphasis="critical"
        />
        <MetricTile
          label="Total in heat"
          value={hot.length + critical.length}
        />
        <MetricTile
          label="Total dollars in heat"
          value={formatUSD(
            [...hot, ...critical].reduce((s, j) => s + j.balance, 0),
          )}
        />
      </section>

      {/* Tabs */}
      <div className="border-border flex gap-1 border-b">
        <TabLink active={tab === 'follow-ups'} href="/dashboard/follow-ups">
          Rep follow-ups · {hot.length}
        </TabLink>
        <TabLink active={tab === 'queue'} href="/dashboard/follow-ups?tab=queue">
          Executive review queue · {critical.length}
        </TabLink>
      </div>

      <section className="space-y-3">
        {visible.length === 0 ? (
          <Card>
            <p className="text-text-secondary">
              {tab === 'queue'
                ? 'Executive queue is clear. Nothing has crossed the Critical threshold today.'
                : "Nothing in the Hot band today. Nothing for me to draft."}
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {visible.map((job) => (
              <FollowUpRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FollowUpRow({ job }: { job: ARJob }) {
  const draft = generateFollowUpDraft(job);
  return (
    <Card className="!py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-display truncate text-xl tracking-tight">{job.address}</p>
          <p className="text-text-secondary text-sm">
            {job.rep?.name ?? 'Unassigned'} · {job.region ?? '—'} ·{' '}
            {job.isInsurance ? 'Insurance' : 'Retail'} · {job.daysSinceInstall} days post-install
          </p>
          {job.missingMilestones.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {job.missingMilestones.map((label) => (
                <MissingStepTag key={label} label={label} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-3">
          <p className="font-display text-2xl tracking-tight tabular-nums">
            {formatUSD(job.balance)}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <AgingChip bucket={job.agingBucket} />
            <HeatScoreBadge
              score={job.heatScore}
              band={job.heatBand}
              breakdown={job.heatBreakdown}
              size="sm"
            />
          </div>
          {job.rep?.email ? (
            <DraftEmailButton
              repName={job.rep.name}
              repEmail={job.rep.email}
              subject={draft.subject}
              body={draft.body}
            />
          ) : (
            <span className="text-text-muted text-xs italic">No rep email on file</span>
          )}
        </div>
      </div>
    </Card>
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
    <a
      href={href}
      className={
        active
          ? 'border-accent text-text-primary -mb-px border-b-2 px-5 py-3 text-sm font-medium'
          : 'text-text-secondary hover:text-text-primary border-b-2 border-transparent px-5 py-3 text-sm'
      }
    >
      {children}
    </a>
  );
}
