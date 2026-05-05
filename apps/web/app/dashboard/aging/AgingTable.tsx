import { AgingChip, AnomalyTag, HeatScoreBadge } from '@vera/ui';
import { formatUSD } from '@vera/utils';
import type { ARJob } from '@vera/types';

export function AgingTable({ jobs }: { jobs: ARJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="border-border bg-bg-card rounded-[var(--radius-card)] border p-8">
        <p className="text-text-secondary">
          Nothing matches the current filter. Clear it to see the full list.
        </p>
      </div>
    );
  }

  return (
    <div className="border-border bg-bg-card overflow-hidden rounded-[var(--radius-card)] border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border text-text-muted border-b text-left text-[0.65rem] tracking-[0.15em] uppercase">
            <th className="px-5 py-3 font-medium">Job</th>
            <th className="px-5 py-3 font-medium">Rep</th>
            <th className="px-5 py-3 text-right font-medium">Balance</th>
            <th className="px-5 py-3 font-medium">Aging</th>
            <th className="px-5 py-3 text-right font-medium">Days past</th>
            <th className="px-5 py-3 text-right font-medium">Heat</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job.id}
              className="border-border last:border-b-0 border-b align-top transition-colors hover:bg-[color:var(--color-bg-base)]"
            >
              <td className="px-5 py-4 align-top">
                <p className="text-text-primary font-medium">{job.address}</p>
                <p className="text-text-muted mt-0.5 text-xs">
                  {job.region ?? '—'} · {job.isInsurance ? 'Insurance' : 'Retail'}
                </p>
                {job.anomalies.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {job.anomalies.slice(0, 3).map((flag) => (
                      <AnomalyTag key={flag} flag={flag} />
                    ))}
                  </div>
                ) : null}
              </td>
              <td className="text-text-secondary px-5 py-4 align-top">
                {job.rep?.name ?? 'Unassigned'}
              </td>
              <td className="px-5 py-4 text-right align-top tabular-nums">
                {formatUSD(job.balance)}
              </td>
              <td className="px-5 py-4 align-top">
                <AgingChip bucket={job.agingBucket} />
              </td>
              <td className="px-5 py-4 text-right align-top tabular-nums">
                {job.daysPastTerms === 0 ? (
                  <span className="text-text-muted">—</span>
                ) : (
                  job.daysPastTerms
                )}
              </td>
              <td className="px-5 py-4 align-top text-right">
                <HeatScoreBadge
                  score={job.heatScore}
                  band={job.heatBand}
                  breakdown={job.heatBreakdown}
                  size="sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
