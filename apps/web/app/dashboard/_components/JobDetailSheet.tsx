'use client';

import { Check, X as XIcon } from 'lucide-react';
import {
  AgingChip,
  AnomalyTag,
  HeatMeter,
  Sheet,
} from '@vera/ui';
import { formatUSD } from '@vera/utils';
import type { ARJob } from '@vera/types';

export function JobDetailSheet({
  job,
  open,
  onOpenChange,
}: {
  job: ARJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!job) {
    return <Sheet open={open} onOpenChange={onOpenChange} title="" children={null} />;
  }

  const installedOn = new Date(job.dateCompleted).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={job.address}
      description={`${job.rep?.name ?? 'Unassigned'} · ${job.region ?? '—'} · ${
        job.isInsurance ? 'Insurance' : 'Retail'
      }`}
    >
      <div className="space-y-8">
        {/* Top row — heat + balance */}
        <section className="space-y-4">
          <HeatMeter
            score={job.heatScore}
            band={job.heatBand}
            breakdown={job.heatBreakdown}
          />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Balance" value={formatUSD(job.balance)} />
            <Stat label="Contract" value={formatUSD(job.gtPrice)} />
            <Stat label="Payments" value={formatUSD(job.payments)} />
            <Stat
              label="Aging"
              value={<AgingChip bucket={job.agingBucket} className="!text-sm" />}
            />
          </div>
        </section>

        {/* Install + terms */}
        <Section title="Install & terms">
          <DefList
            items={[
              { label: 'Installed on', value: installedOn },
              { label: 'Days since install', value: `${job.daysSinceInstall} days` },
              {
                label: 'Net terms',
                value: `Net ${job.netTerms} (${job.isInsurance ? 'insurance' : 'retail'})`,
              },
              {
                label: 'Days past terms',
                value:
                  job.daysPastTerms === 0 ? 'Within terms' : `${job.daysPastTerms} days past`,
              },
              {
                label: 'Last edit',
                value:
                  job.daysSinceLastEdit < 999
                    ? `${job.daysSinceLastEdit} days ago`
                    : 'No record of edit',
              },
            ]}
          />
        </Section>

        {/* Milestones */}
        <Section title="Milestones">
          <ul className="space-y-2">
            <Milestone label="Certificate of completion" done={job.hasCertOfCompletion} />
            {job.isInsurance ? (
              <>
                <Milestone label="First check endorsed" done={job.hasFirstCheckEndorsed} />
                <Milestone label="Final check endorsed" done={job.hasFinalCheckEndorsed} />
              </>
            ) : null}
            <Milestone label="Commission requested" done={job.hasCommissionRequest} />
          </ul>
        </Section>

        {/* Anomalies */}
        {job.anomalies.length > 0 ? (
          <Section title={`Anomalies — ${job.anomalies.length}`}>
            <div className="flex flex-wrap gap-2">
              {job.anomalies.map((flag) => (
                <AnomalyTag key={flag} flag={flag} />
              ))}
            </div>
          </Section>
        ) : null}

        {/* Customer */}
        <Section title="Customer & rep">
          <DefList
            items={[
              { label: 'Customer', value: job.customerName ?? '—' },
              { label: 'Rep', value: job.rep?.name ?? 'Unassigned' },
              { label: 'Rep email', value: job.rep?.email ?? '—' },
              { label: 'Lead source', value: job.leadSource ?? '—' },
              { label: 'Lead status', value: job.leadStatus ?? '—' },
            ]}
          />
        </Section>
      </div>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-bg-base border-border rounded-2xl border p-4">
      <p className="text-text-muted text-[0.65rem] tracking-[0.18em] uppercase">{label}</p>
      <p className="font-display mt-1 text-xl tabular-nums">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-text-secondary text-[0.65rem] font-semibold tracking-[0.2em] uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DefList({ items }: { items: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <dl className="border-border divide-border divide-y border-y">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-text-muted text-sm">{it.label}</dt>
          <dd className="text-text-primary text-sm font-medium">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Milestone({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-3 text-sm">
      {done ? (
        <span
          className="bg-success/15 text-success inline-flex h-5 w-5 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <Check className="h-3 w-3" />
        </span>
      ) : (
        <span
          className="bg-heat-hot/15 text-heat-hot inline-flex h-5 w-5 items-center justify-center rounded-full"
          aria-hidden="true"
        >
          <XIcon className="h-3 w-3" />
        </span>
      )}
      <span className={done ? 'text-text-primary' : 'text-text-secondary'}>{label}</span>
      <span className="text-text-muted ml-auto text-xs">{done ? 'Logged' : 'Missing'}</span>
    </li>
  );
}
