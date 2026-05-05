import { AnomalyTag, Card, MetricTile, VeraQuote } from '@vera/ui';
import { formatUSD } from '@vera/utils';
import type { ARJob, AgingBucket, AnomalyFlag } from '@vera/types';
import { getData } from '@/lib/data';
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

export default async function AgingPage({
  searchParams,
}: {
  searchParams: Promise<{ bucket?: string; rep?: string }>;
}) {
  const params = await searchParams;
  const { jobs } = getData();

  // Bucket summary uses ALL jobs so the chart doesn't move when filtering.
  const bucketSummary: Record<AgingBucket, { count: number; total: number }> = {
    'within-terms': { count: 0, total: 0 },
    '1-30-past': { count: 0, total: 0 },
    '31-60-past': { count: 0, total: 0 },
    '60-plus-past': { count: 0, total: 0 },
  };
  for (const j of jobs) {
    bucketSummary[j.agingBucket].count += 1;
    bucketSummary[j.agingBucket].total += j.balance;
  }

  // Filtered list
  let visible: ARJob[] = jobs;
  const bucketFilter = isAgingBucket(params.bucket) ? params.bucket : undefined;
  if (bucketFilter) visible = visible.filter((j) => j.agingBucket === bucketFilter);
  if (params.rep) visible = visible.filter((j) => j.rep?.id?.toString() === params.rep);
  visible = [...visible].sort((a, b) => b.daysPastTerms - a.daysPastTerms);

  // Anomaly groupings
  const byAnomaly: Record<string, ARJob[]> = {};
  for (const j of jobs) {
    for (const flag of j.anomalies) {
      if (!byAnomaly[flag]) byAnomaly[flag] = [];
      byAnomaly[flag]!.push(j);
    }
  }
  const anomalyEntries = Object.entries(byAnomaly).sort((a, b) => b[1].length - a[1].length);

  const totalOver = bucketSummary['1-30-past'].total +
    bucketSummary['31-60-past'].total +
    bucketSummary['60-plus-past'].total;

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <header className="space-y-3">
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

      {/* Bucket distribution */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {BUCKET_ORDER.map((b) => (
          <BucketTile
            key={b}
            label={BUCKET_LABEL[b]}
            count={bucketSummary[b].count}
            total={bucketSummary[b].total}
            bucket={b}
            isActive={bucketFilter === b}
          />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[3fr_2fr]">
        {/* Table */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
              By job — {visible.length} {visible.length === 1 ? 'row' : 'rows'}
            </h2>
            {(bucketFilter || params.rep) && (
              <a href="/dashboard/aging" className="text-accent text-sm hover:underline">
                Clear filters
              </a>
            )}
          </div>
          <AgingTable jobs={visible} />
        </section>

        {/* Anomaly side panel */}
        <aside className="space-y-3">
          <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">
            What looks strange
          </h2>
          {anomalyEntries.length === 0 ? (
            <Card>
              <p className="text-text-secondary">
                Nothing tripped today. I&apos;ll keep watching.
              </p>
            </Card>
          ) : (
            <Card>
              <ul className="space-y-3">
                {anomalyEntries.map(([flag, jobs]) => (
                  <li
                    key={flag}
                    className="border-border flex items-start justify-between gap-4 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p className="text-text-primary text-sm font-medium">
                        {ANOMALY_LABELS[flag as AnomalyFlag]}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <AnomalyTag flag={flag as AnomalyFlag} />
                      </div>
                    </div>
                    <span className="font-display text-text-primary text-2xl tabular-nums">
                      {jobs.length}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function BucketTile({
  label,
  count,
  total,
  bucket,
  isActive,
}: {
  label: string;
  count: number;
  total: number;
  bucket: AgingBucket;
  isActive: boolean;
}) {
  const href = isActive ? '/dashboard/aging' : `/dashboard/aging?bucket=${bucket}`;
  const emphasis: 'default' | 'accent' | 'critical' =
    bucket === '60-plus-past' ? 'critical' : bucket === '31-60-past' ? 'accent' : 'default';
  return (
    <a href={href} className={isActive ? 'ring-accent block rounded-[var(--radius-card)] ring-2' : 'block'}>
      <MetricTile
        label={label}
        value={count}
        hint={formatUSD(total)}
        emphasis={emphasis}
      />
    </a>
  );
}

function isAgingBucket(value: string | undefined): value is AgingBucket {
  return (
    value === 'within-terms' ||
    value === '1-30-past' ||
    value === '31-60-past' ||
    value === '60-plus-past'
  );
}
