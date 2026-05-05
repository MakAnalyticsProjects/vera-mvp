import { Card, MetricTile, VeraQuote } from '@vera/ui';
import { getData } from '@/lib/data';
import { MilestonesTable } from './MilestonesTable';

export default function MilestonesPage() {
  const { jobs } = getData();

  const sorted = [...jobs].sort((a, b) => {
    if (b.missingMilestones.length !== a.missingMilestones.length) {
      return b.missingMilestones.length - a.missingMilestones.length;
    }
    return b.daysSinceInstall - a.daysSinceInstall;
  });

  const noCert = jobs.filter((j) => !j.hasCertOfCompletion).length;
  const noFinalCheck = jobs.filter((j) => j.isInsurance && !j.hasFinalCheckEndorsed).length;
  const noCommission = jobs.filter((j) => !j.hasCommissionRequest).length;
  const allClear = jobs.filter((j) => j.missingMilestones.length === 0).length;

  const narrative = composeNarrative({
    total: jobs.length,
    allClear,
    noCert,
    noFinalCheck,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <header className="space-y-3 vera-rise">
        <p className="text-text-muted text-xs tracking-[0.2em] uppercase">
          Daily · job milestone tracking
        </p>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">
          Where each install actually stands
        </h1>
        <VeraQuote>{narrative}</VeraQuote>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 vera-rise-delay-1">
        <MetricTile
          label="Missing cert of completion"
          value={noCert}
          hint="Blocks the final check"
          emphasis={noCert > 0 ? 'critical' : 'default'}
        />
        <MetricTile
          label="Insurance — final check open"
          value={noFinalCheck}
          hint="Depreciation outstanding"
          emphasis="accent"
        />
        <MetricTile
          label="No commission requested"
          value={noCommission}
          hint="A behavioral tell from the rep"
        />
        <MetricTile label="Paperwork current" value={allClear} hint="Nothing to chase" />
      </section>

      <section className="space-y-3 vera-rise-delay-2">
        <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
          By job — most gaps first
        </h2>
        {sorted.length === 0 ? (
          <Card>
            <p className="text-text-secondary">No AR jobs to track milestones for today.</p>
          </Card>
        ) : (
          <MilestonesTable jobs={sorted} />
        )}
      </section>
    </div>
  );
}

function composeNarrative({
  total,
  allClear,
  noCert,
  noFinalCheck,
}: {
  total: number;
  allClear: number;
  noCert: number;
  noFinalCheck: number;
}): string {
  if (allClear === total) {
    return "Every AR job has its paperwork current today. That's a clean board.";
  }
  const parts: string[] = [];
  if (noCert > 0) {
    parts.push(
      `${noCert} ${noCert === 1 ? 'install is' : 'installs are'} sitting without a certificate of completion`,
    );
  }
  if (noFinalCheck > 0) {
    parts.push(
      `${noFinalCheck} insurance ${noFinalCheck === 1 ? 'job is' : 'jobs are'} still waiting on the depreciation check`,
    );
  }
  const intro = parts.length === 0 ? 'A few jobs are missing milestone steps' : parts.join(' and ');
  return `${intro}. The table below is sorted by how many gaps each job has — anything I see, you can see.`;
}
