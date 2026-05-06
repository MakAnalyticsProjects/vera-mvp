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
import { formatUSD } from '@vera/utils';
import type { ARJob } from '@vera/types';
import { ReconciliationList } from './ReconciliationList';

export function ReconciliationView({ jobs }: { jobs: ARJob[] }) {
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

  // Reconciliation universe = jobs that fellThroughCracks
  const universe = useMemo(() => jobs.filter((j) => j.fellThroughCracks), [jobs]);

  const filterGroups: FilterGroup[] = useMemo(() => {
    const repCounts = new Map<string, number>();
    const regionCounts = new Map<string, number>();
    for (const j of universe) {
      if (j.rep?.id) {
        const key = `${j.rep.id}`;
        repCounts.set(key, (repCounts.get(key) ?? 0) + 1);
      }
      if (j.region) regionCounts.set(j.region, (regionCounts.get(j.region) ?? 0) + 1);
    }
    const repOptions = [...repCounts.entries()]
      .map(([id, count]) => {
        const job = universe.find((j) => j.rep?.id?.toString() === id);
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
    ];
  }, [universe]);

  const filtered = useMemo(() => {
    return universe.filter((j) => {
      if (repFilter.length > 0 && !repFilter.includes(`${j.rep?.id ?? ''}`)) return false;
      if (regionFilter.length > 0 && !regionFilter.includes(j.region ?? '')) return false;
      return true;
    });
  }, [universe, repFilter, regionFilter]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.daysPastTerms - a.daysPastTerms),
    [filtered],
  );

  const totalStuck = sorted.reduce((s, j) => s + j.balance, 0);
  const oldest = sorted[0]?.daysSinceInstall ?? 0;
  const distinctReps = new Set(sorted.map((j) => j.rep?.id).filter(Boolean)).size;

  const safePageSize = pageSize as PageSize;
  const pagedJobs = sorted.slice((page - 1) * safePageSize, page * safePageSize);
  const filterCount = repFilter.length + regionFilter.length;

  const narrative =
    sorted.length === 0
      ? "Nothing fell through this week (in the current view). Every completed install has at least one fresh signal — paperwork, an endorsed check, a commission request, or a recent edit. I'll keep watching."
      : `${sorted.length} ${
          sorted.length === 1 ? 'install has' : 'installs have'
        } gone quiet — no insurance check endorsement, no certificate of completion, no commission request, and no edits in the last two weeks. That's ${formatUSD(
          totalStuck,
        )} sitting somewhere unattended, across ${distinctReps} ${
          distinctReps === 1 ? 'rep' : 'reps'
        }. The oldest one was installed ${oldest} days ago.`;

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <header className="space-y-3 vera-rise">
        <p className="text-text-muted text-xs tracking-[0.2em] uppercase">
          Weekly · unpaid job reconciliation
        </p>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">
          Fell through cracks
        </h1>
        <VeraQuote>{narrative}</VeraQuote>
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 vera-rise-delay-1">
        <MetricTile
          label="Stuck jobs"
          value={sorted.length}
          emphasis={sorted.length > 0 ? 'critical' : 'default'}
          tooltip="Completed installs with zero signs of life — no insurance check endorsed in 30 days, no certificate of completion, no commission request, and no record edits in the last 14 days."
        />
        <MetricTile
          label="Locked up"
          value={formatUSD(totalStuck)}
          tooltip="Total dollars sitting in stuck jobs. Revenue already worked but not actively being collected."
        />
        <MetricTile
          label="Reps affected"
          value={distinctReps}
          tooltip="Number of distinct reps with at least one stuck job. High = systemic; low = concentrated."
        />
        <MetricTile
          label="Oldest install"
          value={oldest > 0 ? `${oldest} days` : '—'}
          tooltip="Days since the oldest stuck install. Past 12 months, recovery rates drop sharply."
        />
      </section>

      <section className="space-y-3 vera-rise-delay-2">
        <TableToolbar
          title={`The list — ${sorted.length} ${sorted.length === 1 ? 'job' : 'jobs'}`}
          subtitle={
            filterCount > 0
              ? `${filterCount} ${filterCount === 1 ? 'filter' : 'filters'} applied`
              : 'Oldest first'
          }
        >
          <FilterMenu
            groups={filterGroups}
            selected={{ reps: repFilter, regions: regionFilter }}
            onSelectedChange={(next) => {
              setRepFilter(next.reps ?? []);
              setRegionFilter(next.regions ?? []);
              setPage(1);
            }}
          />
        </TableToolbar>
        {sorted.length === 0 ? (
          <Card>
            <p className="text-text-secondary">
              Nothing to reconcile in this view. Open the aging report to keep an eye on
              what&apos;s drifting toward stuck.
            </p>
          </Card>
        ) : (
          <ReconciliationList
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
