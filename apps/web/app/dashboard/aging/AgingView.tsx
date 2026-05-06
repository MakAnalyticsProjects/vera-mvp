'use client';

import { useMemo, useState } from 'react';
import { useQueryState, parseAsInteger, parseAsArrayOf, parseAsString } from 'nuqs';
import { AlertTriangle } from 'lucide-react';
import {
  BarChart,
  Card,
  FilterMenu,
  type FilterGroup,
  MetricTile,
  TablePagination,
  type PageSize,
  TableToolbar,
  Tooltip,
  VeraQuote,
} from '@vera/ui';
import { formatUSD } from '@vera/utils';
import type { ARJob, AgingBucket, AnomalyFlag } from '@vera/types';
import { AgingTable } from './AgingTable';

const BUCKET_LABEL: Record<AgingBucket, string> = {
  'within-terms': 'Within terms',
  '1-30-past': '1–30 past',
  '31-60-past': '31–60 past',
  '60-plus-past': '60+ past',
};

const BUCKET_ORDER: AgingBucket[] = [
  'within-terms',
  '1-30-past',
  '31-60-past',
  '60-plus-past',
];

const BUCKET_COLOR: Record<AgingBucket, string> = {
  'within-terms': 'var(--color-text-muted)',
  '1-30-past': 'var(--color-heat-warm)',
  '31-60-past': 'var(--color-heat-hot)',
  '60-plus-past': 'var(--color-heat-critical)',
};

const ANOMALY_LABELS: Record<AnomalyFlag, string> = {
  'balance-exceeds-price': 'Balance exceeds price',
  'no-cert-of-completion': 'No cert of completion',
  'insurance-final-check-stuck': 'Insurance final check stuck',
  'retail-no-payment': 'Retail — no payments',
  'duplicate-address': 'Duplicate address',
  'no-commission-request': 'No commission request',
  'impossible-payments': 'Impossible payments',
  'archived-with-balance': 'Archived but owing',
  'warranty-voided-with-balance': 'Warranty voided',
};

const ANOMALY_TOOLTIPS: Record<AnomalyFlag, string> = {
  'balance-exceeds-price':
    'Outstanding balance is greater than the contract price — likely a data error or stale estimate.',
  'no-cert-of-completion':
    'Job is installed but no certificate of completion has been logged after 14 days. Insurance final checks rely on this.',
  'insurance-final-check-stuck':
    'Insurance job installed 60+ days ago without the final (depreciation) check endorsed.',
  'retail-no-payment':
    'Retail/cash job installed 30+ days ago with zero payments received.',
  'duplicate-address':
    'Multiple records exist at this address with overlapping dates. Could be a duplicate or warranty work.',
  'no-commission-request':
    "No commission request has been logged after 14 days post-install. Often a tell that the rep believes something is off.",
  'impossible-payments':
    'Payment values are inconsistent (negative or exceeding the contract price).',
  'archived-with-balance':
    'The estimate is archived but a balance is still showing — a zombie record.',
  'warranty-voided-with-balance':
    'Warranty has been voided yet balance remains owing — disputed work.',
};

const BUCKET_TOOLTIPS: Record<AgingBucket, string> = {
  'within-terms':
    "Jobs where the customer's payment clock hasn't run out yet. Net 30 for retail, Net 60 for insurance, measured from install date. Click to filter the table to just these.",
  '1-30-past':
    'Jobs that are 1–30 days past their payment terms. First nudge territory. Click to filter the table.',
  '31-60-past':
    'Jobs that are 31–60 days past terms. Escalation territory — these are starting to feel stuck. Click to filter the table.',
  '60-plus-past':
    'Jobs more than 60 days past terms. Likely needs executive intervention. Click to filter the table.',
};

export function AgingView({ jobs }: { jobs: ARJob[] }) {
  // URL state
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState(
    'pageSize',
    parseAsInteger.withDefault(25),
  );
  const [bucketFilter, setBucketFilter] = useQueryState(
    'buckets',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [repFilter, setRepFilter] = useQueryState(
    'reps',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [regionFilter, setRegionFilter] = useQueryState(
    'regions',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [jobTypeFilter, setJobTypeFilter] = useQueryState(
    'jobTypes',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [anomalyFilter, setAnomalyFilter] = useQueryState(
    'anomalies',
    parseAsArrayOf(parseAsString).withDefault([]),
  );

  // Filter options derived from full job set
  const filterGroups: FilterGroup[] = useMemo(() => {
    const repCounts = new Map<string, number>();
    const regionCounts = new Map<string, number>();
    const jobTypeCounts = new Map<string, number>();
    const anomalyCounts = new Map<string, number>();
    for (const j of jobs) {
      if (j.rep?.id) {
        const key = `${j.rep.id}`;
        repCounts.set(key, (repCounts.get(key) ?? 0) + 1);
      }
      if (j.region) regionCounts.set(j.region, (regionCounts.get(j.region) ?? 0) + 1);
      if (j.jobType)
        jobTypeCounts.set(j.jobType, (jobTypeCounts.get(j.jobType) ?? 0) + 1);
      for (const a of j.anomalies) anomalyCounts.set(a, (anomalyCounts.get(a) ?? 0) + 1);
    }

    const repOptions = [...repCounts.entries()]
      .map(([id, count]) => {
        const job = jobs.find((j) => j.rep?.id?.toString() === id);
        return { value: id, label: job?.rep?.name ?? '—', count };
      })
      .sort((a, b) => b.count - a.count);

    return [
      {
        key: 'buckets',
        label: 'Aging bucket',
        options: BUCKET_ORDER.map((b) => ({
          value: b,
          label: BUCKET_LABEL[b],
        })),
      },
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
        key: 'jobTypes',
        label: 'Job type',
        options: [...jobTypeCounts.entries()].map(([t, c]) => ({
          value: t,
          label: t === 'r' ? 'Residential' : t === 'c' ? 'Commercial' : t,
          count: c,
        })),
      },
      {
        key: 'anomalies',
        label: 'Anomaly',
        options: [...anomalyCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([a, c]) => ({
            value: a,
            label: ANOMALY_LABELS[a as AnomalyFlag],
            count: c,
          })),
      },
    ];
  }, [jobs]);

  const selectedFilters = {
    buckets: bucketFilter,
    reps: repFilter,
    regions: regionFilter,
    jobTypes: jobTypeFilter,
    anomalies: anomalyFilter,
  };

  function setSelected(next: Record<string, string[]>) {
    setBucketFilter(next.buckets ?? []);
    setRepFilter(next.reps ?? []);
    setRegionFilter(next.regions ?? []);
    setJobTypeFilter(next.jobTypes ?? []);
    setAnomalyFilter(next.anomalies ?? []);
    setPage(1);
  }

  // Apply filters
  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (bucketFilter.length > 0 && !bucketFilter.includes(j.agingBucket)) return false;
      if (repFilter.length > 0 && !repFilter.includes(`${j.rep?.id ?? ''}`)) return false;
      if (regionFilter.length > 0 && !regionFilter.includes(j.region ?? '')) return false;
      if (jobTypeFilter.length > 0 && !jobTypeFilter.includes(j.jobType ?? ''))
        return false;
      if (anomalyFilter.length > 0 && !j.anomalies.some((a) => anomalyFilter.includes(a)))
        return false;
      return true;
    });
  }, [jobs, bucketFilter, repFilter, regionFilter, jobTypeFilter, anomalyFilter]);

  // Bucket summary (filter-aware)
  const bucketSummary: Record<AgingBucket, { count: number; total: number }> = useMemo(() => {
    const init = (): Record<AgingBucket, { count: number; total: number }> => ({
      'within-terms': { count: 0, total: 0 },
      '1-30-past': { count: 0, total: 0 },
      '31-60-past': { count: 0, total: 0 },
      '60-plus-past': { count: 0, total: 0 },
    });
    const out = init();
    for (const j of filtered) {
      out[j.agingBucket].count += 1;
      out[j.agingBucket].total += j.balance;
    }
    return out;
  }, [filtered]);

  const totalOver =
    bucketSummary['1-30-past'].total +
    bucketSummary['31-60-past'].total +
    bucketSummary['60-plus-past'].total;

  // Anomaly groupings (filter-aware)
  const anomalyEntries = useMemo(() => {
    const byAnomaly: Record<string, ARJob[]> = {};
    for (const j of filtered) {
      for (const flag of j.anomalies) {
        if (!byAnomaly[flag]) byAnomaly[flag] = [];
        byAnomaly[flag]!.push(j);
      }
    }
    return Object.entries(byAnomaly).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  // Sort + paginate
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.daysPastTerms - a.daysPastTerms),
    [filtered],
  );

  const safePageSize = pageSize as PageSize;
  const pagedJobs = sorted.slice((page - 1) * safePageSize, page * safePageSize);

  const filterCount =
    bucketFilter.length +
    repFilter.length +
    regionFilter.length +
    jobTypeFilter.length +
    anomalyFilter.length;

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <header className="space-y-3 vera-rise">
        <p className="text-text-muted text-xs tracking-[0.2em] uppercase">
          Daily · AR aging & anomaly check
        </p>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">
          What&apos;s late, and what&apos;s strange.
        </h1>
        <VeraQuote>
          {bucketSummary['60-plus-past'].count > 0
            ? `${bucketSummary['60-plus-past'].count} ${
                bucketSummary['60-plus-past'].count === 1 ? 'job is' : 'jobs are'
              } more than 60 days past their terms — that's where I'd focus first. Total past terms: ${formatUSD(totalOver)}.`
            : "Nothing's deeply overdue today. The buckets below show where things stand relative to each customer's terms."}
        </VeraQuote>
      </header>

      {/* Bucket tiles — filter-aware */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 vera-rise-delay-1">
        {BUCKET_ORDER.map((b) => {
          const isActive = bucketFilter.length === 1 && bucketFilter[0] === b;
          const emphasis: 'default' | 'accent' | 'critical' =
            b === '60-plus-past' ? 'critical' : b === '31-60-past' ? 'accent' : 'default';
          return (
            <button
              type="button"
              key={b}
              onClick={() => {
                setBucketFilter(isActive ? [] : [b]);
                setPage(1);
              }}
              className={
                isActive
                  ? 'ring-accent block rounded-[var(--radius-card)] text-left ring-2 transition-all'
                  : 'hover:ring-accent/30 block rounded-[var(--radius-card)] text-left ring-1 ring-transparent transition-all'
              }
            >
              <MetricTile
                label={BUCKET_LABEL[b]}
                value={bucketSummary[b].count}
                hint={formatUSD(bucketSummary[b].total)}
                emphasis={emphasis}
                tooltip={BUCKET_TOOLTIPS[b]}
              />
            </button>
          );
        })}
      </section>

      {/* Distribution + anomaly summary side by side */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2 vera-rise-delay-2">
        <Card>
          <div className="space-y-1">
            <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
              Past-terms distribution
            </h2>
            <p className="text-text-muted text-xs">
              How the {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'} in scope
              split across the four buckets.
            </p>
          </div>
          <div className="mt-6">
            <BarChart
              data={BUCKET_ORDER.map((b) => ({
                label: BUCKET_LABEL[b],
                value: bucketSummary[b].count,
                color: BUCKET_COLOR[b],
                hint: formatUSD(bucketSummary[b].total),
              }))}
              format={(n) => `${n} ${n === 1 ? 'job' : 'jobs'}`}
            />
          </div>
        </Card>

        <Card>
          <div className="space-y-1">
            <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
              What looks strange
            </h2>
            <p className="text-text-muted text-xs">
              {anomalyEntries.length === 0
                ? 'Nothing tripped in the current view.'
                : `${anomalyEntries.length} anomaly ${
                    anomalyEntries.length === 1 ? 'rule has' : 'rules have'
                  } flagged jobs.`}
            </p>
          </div>
          {anomalyEntries.length === 0 ? (
            <p className="text-text-secondary mt-6 text-sm">
              I&apos;ll keep watching.
            </p>
          ) : (
            <ul className="mt-6 space-y-1">
              {anomalyEntries.map(([flag, list]) => (
                <li key={flag} className="border-border/60 border-b last:border-b-0">
                  <Tooltip
                    content={
                      <span className="block">
                        <span className="block font-semibold">
                          {ANOMALY_LABELS[flag as AnomalyFlag]} — {list.length}{' '}
                          {list.length === 1 ? 'job' : 'jobs'}
                        </span>
                        <span className="mt-1.5 block text-[0.7rem] leading-relaxed">
                          {ANOMALY_TOOLTIPS[flag as AnomalyFlag]}
                        </span>
                      </span>
                    }
                    side="top"
                    block
                  >
                    <span className="hover:bg-bg-base/70 flex w-full cursor-help items-center justify-between gap-3 rounded-lg py-2.5 pr-1 pl-1 text-sm transition-colors">
                      <span className="flex items-center gap-2.5">
                        <AlertTriangle
                          className="text-heat-hot h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="text-text-primary">
                          {ANOMALY_LABELS[flag as AnomalyFlag]}
                        </span>
                      </span>
                      <span className="text-text-primary tabular-nums font-semibold">
                        {list.length}
                      </span>
                    </span>
                  </Tooltip>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* Table with toolbar */}
      <section className="space-y-3 vera-rise-delay-3">
        <TableToolbar
          title={`By job — ${sorted.length} ${sorted.length === 1 ? 'row' : 'rows'}`}
          subtitle={
            filterCount > 0
              ? `${filterCount} ${filterCount === 1 ? 'filter' : 'filters'} applied`
              : undefined
          }
        >
          <FilterMenu
            groups={filterGroups}
            selected={selectedFilters}
            onSelectedChange={setSelected}
          />
        </TableToolbar>
        <AgingTable
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
      </section>
    </div>
  );
}
