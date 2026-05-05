'use client';

import { useState } from 'react';
import { AgingChip, Card, HeatMeter } from '@vera/ui';
import { formatUSD } from '@vera/utils';
import type { ARJob } from '@vera/types';
import { JobDetailSheet } from '../_components/JobDetailSheet';

export function ReconciliationList({ jobs }: { jobs: ARJob[] }) {
  const [selected, setSelected] = useState<ARJob | null>(null);

  return (
    <>
      <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
        {jobs.map((job) => (
          <Card
            key={job.id}
            className="!py-5 cursor-pointer transition-shadow hover:shadow-[0_4px_16px_-6px_rgba(31,27,22,0.08)]"
            onClick={() => setSelected(job)}
          >
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-display truncate text-xl tracking-tight">
                  {job.address}
                </p>
                <p className="text-text-secondary text-sm">
                  {job.rep?.name ?? 'Unassigned'} · {job.region ?? '—'} ·{' '}
                  {job.isInsurance ? 'Insurance' : 'Retail'} · installed{' '}
                  {job.daysSinceInstall} days ago
                </p>
                {job.fellThroughCracksReasons.length > 0 ? (
                  <ul className="text-text-muted mt-3 space-y-1.5 text-sm">
                    {job.fellThroughCracksReasons.map((reason) => (
                      <li key={reason} className="flex items-start gap-2">
                        <span
                          className="bg-text-muted/40 mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full"
                          aria-hidden="true"
                        />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-3">
                <p className="font-display text-2xl tracking-tight tabular-nums">
                  {formatUSD(job.balance)}
                </p>
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

      <JobDetailSheet
        job={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
