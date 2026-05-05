'use client';

import { useState } from 'react';
import {
  AgingChip,
  Card,
  HeatMeter,
  MissingStepTag,
} from '@vera/ui';
import { formatUSD } from '@vera/utils';
import { generateFollowUpDraft } from '@vera/domain';
import type { ARJob } from '@vera/types';
import { JobDetailSheet } from '../_components/JobDetailSheet';
import { DraftEmailButton } from './DraftEmailButton';

export function FollowUpsList({ jobs }: { jobs: ARJob[] }) {
  const [selected, setSelected] = useState<ARJob | null>(null);

  return (
    <>
      <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
        {jobs.map((job) => (
          <FollowUpRow key={job.id} job={job} onOpen={() => setSelected(job)} />
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

function FollowUpRow({ job, onOpen }: { job: ARJob; onOpen: () => void }) {
  const draft = generateFollowUpDraft(job);
  return (
    <Card
      className="!py-5 cursor-pointer transition-shadow hover:shadow-[0_4px_16px_-6px_rgba(31,27,22,0.08)]"
      onClick={onOpen}
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-display truncate text-xl tracking-tight">{job.address}</p>
          <p className="text-text-secondary text-sm">
            {job.rep?.name ?? 'Unassigned'} · {job.region ?? '—'} ·{' '}
            {job.isInsurance ? 'Insurance' : 'Retail'} · {job.daysSinceInstall} days post-install
          </p>
          {job.missingMilestones.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {job.missingMilestones.map((label) => (
                <MissingStepTag key={label} label={label} />
              ))}
            </div>
          ) : null}
        </div>
        <div
          className="flex flex-col items-end gap-3"
          onClick={(e) => e.stopPropagation()}
        >
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
