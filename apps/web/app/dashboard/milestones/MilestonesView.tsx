'use client';

import { useMemo } from 'react';
import { useQueryState, parseAsInteger, parseAsArrayOf, parseAsString } from 'nuqs';
import {
  Card,
  FilterMenu,
  type FilterGroup,
  MetricTile,
  TablePagination,
  type PageSize,
  TableToolbar,
  VeraQuote,
} from '@vera/ui';
import type { ARJob } from '@vera/types';
import { MilestonesTable } from './MilestonesTable';

const MILESTONE_OPTIONS = [
  { value: 'cert', label: 'Missing cert of completion' },
  { value: 'finalCheck', label: 'Insurance — final check open' },
  { value: 'commission', label: 'No commission requested' },
  { value: 'allClear', label: 'Paperwork current' },
] as const;

export function MilestonesView({ jobs }: { jobs: ARJob[] }) {
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState(
    'pageSize',
    parseAsInteger.withDefault(25),
  );
  const [repFilter, setRepFilter] = useQueryState(
    'reps',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [regionFilter, setRegionFilter] = useQueryState(
    'regions',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [missingFilter, setMissingFilter] = useQueryState(
    'missing',
    parseAsArrayOf(parseAsString).withDefault([]),
  );

  const filterGroups: FilterGroup[] = useMemo(() => {
    const repCounts = new Map<string, number>();
    const regionCounts = new Map<string, number>();
    for (const j of jobs) {
      if (j.rep?.id) {
        const key = `${j.rep.id}`;
        repCounts.set(key, (repCounts.get(key) ?? 0) + 1);
      }
      if (j.region) regionCounts.set(j.region, (regionCounts.get(j.region) ?? 0) + 1);
    }

    const repOptions = [...repCounts.entries()]
      .map(([id, count]) => {
        const job = jobs.find((j) => j.rep?.id?.toString() === id);
        return { value: id, label: job?.rep?.name ?? '—', count };
      })
      .sort((a, b) => b.count - a.count);

    return [
      {
        key: 'reps',
        label: 'Rep',
        type: 'dropdown',
        searchPlaceholder: 'Search reps…',
        options: repOptions,
      },
      {
        key: 'regions',
        label: 'Region',
        options: [...regionCounts.entries()]
          .sort()
          .map(([r, c]) => ({ value: r, label: r, count: c })),
      },
      {
        key: 'missing',
        label: 'Milestone status',
        options: MILESTONE_OPTIONS.map((m) => ({ value: m.value, label: m.label })),
      },
    ];
  }, [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (repFilter.length > 0 && !repFilter.includes(`${j.rep?.id ?? ''}`)) return false;
      if (regionFilter.length > 0 && !regionFilter.includes(j.region ?? '')) return false;
      if (missingFilter.length > 0) {
        const flags = {
          cert: !j.hasCertOfCompletion,
          finalCheck: j.isInsurance && !j.hasFinalCheckEndorsed,
          commission: !j.hasCommissionRequest,
          allClear: j.missingMilestones.length === 0,
        };
        if (!missingFilter.some((f) => flags[f as keyof typeof flags])) return false;
      }
      return true;
    });
  }, [jobs, repFilter, regionFilter, missingFilter]);

  const noCert = filtered.filter((j) => !j.hasCertOfCompletion).length;
  const noFinalCheck = filtered.filter(
    (j) => j.isInsurance && !j.hasFinalCheckEndorsed,
  ).length;
  const noCommission = filtered.filter((j) => !j.hasCommissionRequest).length;
  const allClear = filtered.filter((j) => j.missingMilestones.length === 0).length;

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        if (b.missingMilestones.length !== a.missingMilestones.length) {
          return b.missingMilestones.length - a.missingMilestones.length;
        }
        return b.daysSinceInstall - a.daysSinceInstall;
      }),
    [filtered],
  );

  const safePageSize = pageSize as PageSize;
  const pagedJobs = sorted.slice((page - 1) * safePageSize, page * safePageSize);

  const filterCount = repFilter.length + regionFilter.length + missingFilter.length;

  const narrative = composeNarrative({
    total: filtered.length,
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
          tooltip="Jobs where the install is done but no Certificate of Completion has been logged after 14 days. For insurance jobs, the insurer needs this document before they release the final/depreciation check."
        />
        <MetricTile
          label="Insurance — final check open"
          value={noFinalCheck}
          hint="Depreciation outstanding"
          emphasis="accent"
          tooltip="Insurance jobs where the final (depreciation/RCV) check hasn't been endorsed yet. The larger of the two insurance payments, typically arriving 30–90 days post-install."
        />
        <MetricTile
          label="No commission requested"
          value={noCommission}
          hint="A behavioral tell from the rep"
          tooltip="Jobs where the rep hasn't requested commission after 14 days post-install. Reps reliably ask when they think a job will collect — its absence is often a tell."
        />
        <MetricTile
          label="Paperwork current"
          value={allClear}
          hint="Nothing to chase"
          tooltip="Jobs with all milestones logged: certificate of completion, final check (insurance), and commission request."
        />
      </section>

      <section className="space-y-3 vera-rise-delay-2">
        <TableToolbar
          title={`By job — ${sorted.length} ${sorted.length === 1 ? 'row' : 'rows'}`}
          subtitle={
            filterCount > 0
              ? `${filterCount} ${filterCount === 1 ? 'filter' : 'filters'} applied`
              : 'Most gaps first'
          }
        >
          <FilterMenu
            groups={filterGroups}
            selected={{
              reps: repFilter,
              regions: regionFilter,
              missing: missingFilter,
            }}
            onSelectedChange={(next) => {
              setRepFilter(next.reps ?? []);
              setRegionFilter(next.regions ?? []);
              setMissingFilter(next.missing ?? []);
              setPage(1);
            }}
          />
        </TableToolbar>
        {sorted.length === 0 ? (
          <Card>
            <p className="text-text-secondary">No jobs match the current filters.</p>
          </Card>
        ) : (
          <MilestonesTable
            jobs={pagedJobs}
            footer={
              <TablePagination
                total={sorted.length}
                page={page}
                pageSize={safePageSize}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
                standalone
              />
            }
          />
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
  if (total === 0) return 'No jobs match the current filters.';
  if (allClear === total) {
    return "Every AR job in this view has its paperwork current. That's a clean board.";
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
