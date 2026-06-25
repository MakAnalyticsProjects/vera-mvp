'use client';

import { useMemo } from 'react';
import { useQueryState, parseAsInteger, parseAsArrayOf, parseAsString } from 'nuqs';
import {
  Card,
  DateRangeFilter,
  type DateRangePreset,
  type DateRangeValue,
  FilterMenu,
  type FilterGroup,
  MetricTile,
  resolveDateRange,
  TablePagination,
  type PageSize,
  VeraQuote,
} from '@vera/ui';
import { formatUSD } from '@vera/utils';
import type { InstallPaymentsFile, InstallPaymentRecord } from '@vera/types';
import { InstallsTable } from './InstallsTable';

/** Sum of the up-to-four collected payments on a row. */
export function collectedOf(r: InstallPaymentRecord): number {
  return (r.payment1 ?? 0) + (r.payment2 ?? 0) + (r.payment3 ?? 0) + (r.payment4 ?? 0);
}

/** Balances within this band (in dollars) round to "settled". */
const SETTLED_EPSILON = 0.005;

export type InstallStatus = 'outstanding' | 'overpaid' | 'settled' | 'none';

/**
 * Status of a row from its Balance Owed, exactly as recorded in the sheet:
 *   - outstanding: positive balance, customer still owes
 *   - overpaid:    negative balance, a refund/credit is due back
 *   - settled:     effectively zero
 *   - none:        no balance recorded in the sheet (blank cell)
 */
export function installStatus(r: InstallPaymentRecord): InstallStatus {
  const b = r.balanceOwed;
  if (b == null) return 'none';
  if (b > SETTLED_EPSILON) return 'outstanding';
  if (b < -SETTLED_EPSILON) return 'overpaid';
  return 'settled';
}

export function InstallsView({ file }: { file: InstallPaymentsFile }) {
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));
  const [pageSize, setPageSize] = useQueryState('pageSize', parseAsInteger.withDefault(25));
  const [repFilter, setRepFilter] = useQueryState(
    'reps',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [statusFilter, setStatusFilter] = useQueryState(
    'status',
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [range, setRange] = useQueryState('range', parseAsString.withDefault('all'));
  const [from, setFrom] = useQueryState('from', parseAsString);
  const [to, setTo] = useQueryState('to', parseAsString);

  const dateValue = useMemo<DateRangeValue>(
    () => ({ preset: normalizePreset(range), from: from ?? undefined, to: to ?? undefined }),
    [range, from, to],
  );
  // Quick-filter presets resolve against the browser's current date so "This
  // month" stays correct over time and across shared URLs (Q: timezone — render
  // in browser-local TZ, never UTC).
  const dateWindow = useMemo(() => resolveDateRange(dateValue, new Date()), [dateValue]);

  const handleDateChange = (next: DateRangeValue) => {
    setRange(next.preset);
    setFrom(next.preset === 'custom' ? (next.from ?? null) : null);
    setTo(next.preset === 'custom' ? (next.to ?? null) : null);
    setPage(1);
  };

  const filterGroups: FilterGroup[] = useMemo(() => {
    const repCounts = new Map<string, number>();
    const statusCounts: Record<InstallStatus, number> = {
      outstanding: 0,
      overpaid: 0,
      settled: 0,
      none: 0,
    };
    for (const r of file.records) {
      if (r.salesRep) repCounts.set(r.salesRep, (repCounts.get(r.salesRep) ?? 0) + 1);
      statusCounts[installStatus(r)]++;
    }
    const repOptions = [...repCounts.entries()]
      .map(([name, count]) => ({ value: name, label: name, count }))
      .sort((a, b) => b.count - a.count);
    return [
      {
        key: 'status',
        label: 'Status',
        options: [
          { value: 'outstanding', label: 'Outstanding', count: statusCounts.outstanding },
          { value: 'overpaid', label: 'Overpaid · credit due', count: statusCounts.overpaid },
          { value: 'settled', label: 'Settled', count: statusCounts.settled },
          { value: 'none', label: 'No balance recorded', count: statusCounts.none },
        ],
      },
      {
        key: 'reps',
        label: 'Rep',
        type: 'dropdown',
        searchPlaceholder: 'Search reps…',
        options: repOptions,
      },
    ];
  }, [file.records]);

  const filtered = useMemo(() => {
    return file.records.filter((r) => {
      if (repFilter.length > 0 && !repFilter.includes(r.salesRep)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(installStatus(r))) return false;
      // installDate is a 'YYYY-MM-DD' string, so lexicographic compare is chronological.
      if (dateWindow.from && r.installDate < dateWindow.from) return false;
      if (dateWindow.to && r.installDate > dateWindow.to) return false;
      return true;
    });
  }, [file.records, repFilter, statusFilter, dateWindow]);

  const totalContract = filtered.reduce((s, r) => s + (r.contractPrice ?? 0), 0);
  const totalCollected = filtered.reduce((s, r) => s + collectedOf(r), 0);
  const totalOutstanding = filtered.reduce((s, r) => s + (r.balanceOwed ?? 0), 0);
  // Refund/credit owed back to customers (magnitude of negative balances).
  const totalCreditDue = filtered.reduce(
    (s, r) => s + (installStatus(r) === 'overpaid' ? -(r.balanceOwed ?? 0) : 0),
    0,
  );
  const creditDueCount = filtered.filter((r) => installStatus(r) === 'overpaid').length;

  const safePageSize = pageSize as PageSize;
  const paged = filtered.slice((page - 1) * safePageSize, page * safePageSize);

  const filterCount =
    repFilter.length + statusFilter.length + (dateValue.preset !== 'all' ? 1 : 0);
  const periodLabel = file.sourcePeriod === 'Multiple' ? 'multiple months' : monthLabel(file.sourcePeriod);
  const narrative = composeNarrative({
    count: filtered.length,
    region: file.region,
    periodLabel,
    collected: totalCollected,
    outstanding: totalOutstanding,
    creditDue: totalCreditDue,
    creditDueCount,
  });
  const provenance = composeProvenance(file.reviewedLabel, file.clearingNote);

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <header className="space-y-3 vera-rise">
        <p className="text-text-muted text-xs tracking-[0.2em] uppercase">
          {file.region} · installs &amp; payments
        </p>
        <h1 className="font-display text-4xl tracking-tight md:text-5xl">
          What was installed, what got paid
        </h1>
        <VeraQuote>{narrative}</VeraQuote>
        {provenance && (
          <p className="text-text-muted text-xs">
            <span className="text-info font-medium">{provenance.reviewed}</span>
            {provenance.note && <span> · {provenance.note}</span>}
          </p>
        )}
      </header>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4 vera-rise-delay-1">
        <MetricTile
          label="Installs"
          numericValue={filtered.length}
          value={filtered.length}
          hint={periodLabel}
          emphasis="accent"
          tooltip="Number of installs in the current filter, taken from the regional Installs & Payments sheet (not Rooflink)."
        />
        <MetricTile
          label="Contract value"
          numericValue={totalContract}
          format={formatUSD}
          value={formatUSD(totalContract)}
          hint="Sum of Contract Price"
          tooltip="Sum of the Contract Price column. A few rows have a blank contract price in the source sheet and contribute 0 here."
        />
        <MetricTile
          label="Collected"
          numericValue={totalCollected}
          format={formatUSD}
          value={formatUSD(totalCollected)}
          hint="Payments 1–4"
          tooltip="Sum of all collected payments (PMT RCVD 1 through 4). Negative entries (refunds/reversals) are included as entered."
        />
        <MetricTile
          label="Outstanding"
          numericValue={totalOutstanding}
          format={formatUSD}
          value={formatUSD(totalOutstanding)}
          hint="Balance Owed"
          emphasis="critical"
          tooltip="Sum of the Balance Owed column exactly as recorded in the sheet — not recomputed. Negative balances (overpayments) reduce this total."
        />
      </section>

      <section className="space-y-3 vera-rise-delay-2">
        {/* One control row: period pills on the left, Filter on the right, so
            both filter affordances read as a single bar. flex-wrap drops the
            Filter button below the pills on narrow widths. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DateRangeFilter value={dateValue} onChange={handleDateChange} />
          <FilterMenu
            groups={filterGroups}
            selected={{ reps: repFilter, status: statusFilter }}
            onSelectedChange={(next) => {
              setRepFilter(next.reps ?? []);
              setStatusFilter(next.status ?? []);
              setPage(1);
            }}
          />
        </div>
        <div>
          <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
            Installs — {filtered.length} {filtered.length === 1 ? 'row' : 'rows'}
          </h2>
          <p className="text-text-muted mt-1 text-xs">
            {filterCount > 0
              ? `${filterCount} ${filterCount === 1 ? 'filter' : 'filters'} applied`
              : 'Most recent install first'}
          </p>
        </div>
        {filtered.length === 0 ? (
          <Card>
            <p className="text-text-secondary">No installs match the current filters.</p>
          </Card>
        ) : (
          <InstallsTable
            records={paged}
            footer={
              <TablePagination
                total={filtered.length}
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

const DATE_PRESETS: readonly DateRangePreset[] = ['all', 'month', 'last3', 'custom'];
function normalizePreset(raw: string): DateRangePreset {
  return (DATE_PRESETS as readonly string[]).includes(raw) ? (raw as DateRangePreset) : 'all';
}

function monthLabel(period: string): string {
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (!m) return period || '—';
  const [, yyyy, mm] = m;
  const date = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, 1));
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function composeNarrative({
  count,
  region,
  periodLabel,
  collected,
  outstanding,
  creditDue,
  creditDueCount,
}: {
  count: number;
  region: string;
  periodLabel: string;
  collected: number;
  outstanding: number;
  creditDue: number;
  creditDueCount: number;
}): string {
  if (count === 0) {
    return 'No installs in this view. Import a regional Installs & Payments sheet to populate this tab.';
  }
  const creditSentence =
    creditDueCount > 0
      ? ` ${creditDueCount} ${creditDueCount === 1 ? 'install is' : 'installs are'} overpaid, with ${formatUSD(creditDue)} in credit owed back.`
      : '';
  return `${count} ${count === 1 ? 'install' : 'installs'} in ${region} for ${periodLabel}, with ${formatUSD(collected)} collected so far and ${formatUSD(outstanding)} still outstanding.${creditSentence} These figures come straight from the hand-kept ledger — balances are shown exactly as recorded, not recomputed. Click any row to see the payment-by-payment breakdown.`;
}

/**
 * Format the sheet's "Last Reviewed" annotation for the header. Returns null
 * when the sheet carried no annotation.
 */
function composeProvenance(
  reviewedLabel: string | null,
  clearingNote: string | null,
): { reviewed: string; note: string | null } | null {
  if (!reviewedLabel && !clearingNote) return null;
  const reviewed = reviewedLabel ? `Last reviewed ${reviewedLabel}` : 'Last reviewed —';
  const note = clearingNote ? sentenceCase(clearingNote) : null;
  return { reviewed, note };
}

/** "NOT YET CLEARED/DEPOSITED" → "Not yet cleared/deposited". */
function sentenceCase(s: string): string {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
