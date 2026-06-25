'use client';

import { useState } from 'react';
import { Table, TableCell, TableHead, TableRow, TableShell } from '@vera/ui';
import { formatUSD, formatUSDate } from '@vera/utils';
import type { InstallPaymentRecord } from '@vera/types';
import { collectedOf, installStatus } from './InstallsView';
import { InstallDetailSheet } from './InstallDetailSheet';

const COLUMNS = [
  { key: 'customer', label: 'Customer', tooltip: 'Customer name and install address from the sheet.' },
  { key: 'rep', label: 'Rep', width: '150px', tooltip: 'Sales rep, exactly as recorded (some rows credit two reps).' },
  {
    key: 'installed',
    label: 'Installed',
    width: '120px',
    tooltip: 'Install date from the sheet.',
  },
  {
    key: 'contract',
    label: 'Contract',
    align: 'right' as const,
    width: '120px',
    tooltip: 'Contract Price. Blank in the sheet shows as “—”.',
  },
  {
    key: 'collected',
    label: 'Collected',
    align: 'right' as const,
    width: '120px',
    tooltip: 'Sum of payments 1–4 collected against this install.',
  },
  {
    key: 'balance',
    label: 'Balance',
    align: 'right' as const,
    width: '120px',
    tooltip:
      'Balance Owed exactly as recorded in the sheet — not recomputed. Negative = overpaid (credit due back). Blank = no balance recorded.',
  },
];

export function InstallsTable({
  records,
  footer,
}: {
  records: InstallPaymentRecord[];
  footer?: React.ReactNode;
}) {
  const [selected, setSelected] = useState<InstallPaymentRecord | null>(null);

  return (
    <>
      <TableShell maxHeight={720} footer={footer}>
        <Table>
          <TableHead columns={COLUMNS} />
          <tbody>
            {records.map((r) => {
              const balance = r.balanceOwed;
              const status = installStatus(r);
              return (
                <TableRow
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className="cursor-pointer vera-press"
                >
                  <TableCell>
                    <p className="text-text-primary font-medium">{r.customerName || '—'}</p>
                    <p className="text-text-muted mt-0.5 text-xs">{r.address || '—'}</p>
                  </TableCell>
                  <TableCell className="text-text-secondary">{r.salesRep || '—'}</TableCell>
                  <TableCell className="text-text-secondary">
                    {formatUSDate(r.installDate)}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {r.contractPrice != null ? formatUSD(r.contractPrice) : '—'}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {formatUSD(collectedOf(r))}
                  </TableCell>
                  <TableCell align="right" className="tabular-nums">
                    {balance == null ? (
                      <span className="text-text-muted">—</span>
                    ) : status === 'outstanding' ? (
                      <span className="text-heat-critical font-semibold">{formatUSD(balance)}</span>
                    ) : status === 'overpaid' ? (
                      <span className="text-info font-semibold">
                        {formatUSD(balance)}
                        <span className="text-text-muted ml-1 text-xs">credit due</span>
                      </span>
                    ) : (
                      <span>{formatUSD(balance)}</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </tbody>
        </Table>
      </TableShell>

      <InstallDetailSheet
        record={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}
