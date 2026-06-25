'use client';

import { Sheet } from '@vera/ui';
import { formatUSD, formatUSDate } from '@vera/utils';
import type { InstallPaymentRecord } from '@vera/types';
import { collectedOf, installStatus } from './InstallsView';

export function InstallDetailSheet({
  record,
  open,
  onOpenChange,
}: {
  record: InstallPaymentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!record) {
    return <Sheet open={open} onOpenChange={onOpenChange} title="" children={null} />;
  }

  const collected = collectedOf(record);
  const payments = [record.payment1, record.payment2, record.payment3, record.payment4];
  const balance = record.balanceOwed;
  const status = installStatus(record);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={record.customerName || record.address || 'Install'}
      description={`${record.salesRep || 'Unassigned'} · ${record.region} · installed ${formatUSDate(record.installDate)}`}
      widthClass="max-w-2xl"
    >
      <div className="space-y-8">
        <section className="grid grid-cols-2 gap-4">
          <Stat
            label="Contract price"
            value={record.contractPrice != null ? formatUSD(record.contractPrice) : '—'}
          />
          <Stat label="Collected" value={formatUSD(collected)} />
          <Stat
            label={status === 'overpaid' ? 'Balance owed · credit due' : 'Balance owed'}
            value={
              balance == null ? (
                <span className="text-text-muted text-base">No balance recorded</span>
              ) : status === 'outstanding' ? (
                <span className="text-heat-critical">{formatUSD(balance)}</span>
              ) : status === 'overpaid' ? (
                <span className="text-info">{formatUSD(balance)}</span>
              ) : (
                <span>{formatUSD(balance)}</span>
              )
            }
          />
          <Stat label="Address" value={<span className="text-base">{record.address || '—'}</span>} />
        </section>

        <Section title="Payments received">
          <DefList
            items={payments.map((amt, i) => ({
              label: `Payment ${i + 1}`,
              value: amt == null ? '—' : formatUSD(amt),
            }))}
          />
          <p className="text-text-muted text-xs">
            Balance Owed is shown as recorded in the sheet and is not recomputed from contract minus
            payments.
          </p>
        </Section>

        <Section title="Source">
          <DefList
            items={[
              { label: 'Region', value: record.region },
              { label: 'Sheet period', value: record.sourcePeriod },
              { label: 'Sheet row', value: String(record.sourceRow) },
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
          <dd className="text-text-primary text-sm font-medium tabular-nums">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
