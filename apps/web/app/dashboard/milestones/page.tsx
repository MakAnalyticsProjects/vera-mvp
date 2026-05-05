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
          tooltip="Jobs where the install is done but no Certificate of Completion has been logged after 14 days. For insurance jobs, the insurer needs this document before they release the final/depreciation check — so the money can't physically arrive without it."
        />
        <MetricTile
          label="Insurance — final check open"
          value={noFinalCheck}
          hint="Depreciation outstanding"
          emphasis="accent"
          tooltip="Insurance jobs where the final (depreciation/RCV) check hasn't been endorsed yet. This is the larger of the two insurance payments and typically arrives 30–90 days post-install."
        />
        <MetricTile
          label="No commission requested"
          value={noCommission}
          hint="A behavioral tell from the rep"
          tooltip="Jobs where the rep hasn't requested commission after 14 days post-install. Reps reliably ask for commission when they think a job will collect — its absence is often a tell that something is wrong (customer dispute, collection problem, etc.)."
        />
        <MetricTile
          label="Paperwork current"
          value={allClear}
          hint="Nothing to chase"
          tooltip="Jobs with all three milestones logged: certificate of completion, final check (insurance only), and commission request. These are paperwork-clean — Vera has nothing to chase here."
        />
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
