import 'server-only';
import { Prisma } from '@prisma/client';
import {
  InstallPaymentsFileSchema,
  type InstallPaymentRecord,
  type InstallPaymentsFile,
} from '@vera/types';
import { db } from './db';
import { auth } from './auth';

/**
 * Source-of-truth for the Installs & Payments dashboard.
 *
 * Reads the `InstallPayment` rows for `tenantId` straight from Postgres
 * (no Rooflink join, no materialized view — this is Israel's hand-kept
 * regional ledger, ingested by `scripts/import-install-payments.ts`).
 * The table is tiny (tens of rows per month), so each request does a
 * direct `findMany`; there's no version cache to invalidate the way the
 * Rooflink-derived dashboards have.
 *
 * Money columns are Postgres `numeric` → Prisma `Decimal`. They're
 * projected to plain numbers here so the value crosses to the client as
 * JSON. Nulls are preserved (a few sheet cells are genuinely blank) and
 * are treated as 0 only when summing the totals.
 */

function toNum(d: Prisma.Decimal | null): number | null {
  return d == null ? null : d.toNumber();
}

export async function getInstallPayments(tenantId: number): Promise<InstallPaymentsFile> {
  const rows = await db.installPayment.findMany({
    where: { tenantId },
    // Default order: most recent install first. Within a single day, fall back
    // to the original sheet row order for stability.
    orderBy: [{ installDate: 'desc' }, { sourceRow: 'asc' }],
  });

  const records: InstallPaymentRecord[] = rows.map((r) => ({
    id: r.id,
    region: r.region,
    sourcePeriod: r.sourcePeriod,
    sourceRow: r.sourceRow,
    salesRep: r.salesRep,
    customerName: r.customerName,
    address: r.address,
    installDate: r.installDate.toISOString().slice(0, 10),
    contractPrice: toNum(r.contractPrice),
    payment1: toNum(r.payment1),
    payment2: toNum(r.payment2),
    payment3: toNum(r.payment3),
    payment4: toNum(r.payment4),
    balanceOwed: toNum(r.balanceOwed),
  }));

  const totals = records.reduce(
    (acc, r) => {
      acc.totalContractPrice += r.contractPrice ?? 0;
      acc.totalCollected +=
        (r.payment1 ?? 0) + (r.payment2 ?? 0) + (r.payment3 ?? 0) + (r.payment4 ?? 0);
      acc.totalBalanceOwed += r.balanceOwed ?? 0;
      return acc;
    },
    { rowCount: records.length, totalContractPrice: 0, totalCollected: 0, totalBalanceOwed: 0 },
  );

  const uniform = <K extends keyof InstallPaymentRecord>(key: K): string => {
    const set = new Set(records.map((r) => String(r[key])));
    return set.size === 1 ? ([...set][0] ?? 'Multiple') : 'Multiple';
  };

  // Provenance is denormalized identically across a sheet's rows; read it
  // off the first row (null when the table is empty or the sheet had no
  // annotation).
  const first = rows[0];

  return InstallPaymentsFileSchema.parse({
    generatedAt: new Date().toISOString(),
    region: records.length === 0 ? 'Dallas' : uniform('region'),
    sourcePeriod: records.length === 0 ? '' : uniform('sourcePeriod'),
    reviewedLabel: first?.reviewedLabel ?? null,
    clearingNote: first?.clearingNote ?? null,
    totals,
    records,
  });
}

/**
 * Session-aware variant for the installs server page. Same defense-in-depth
 * shape as `getWriteOffsForCurrentSession` — dashboard middleware already
 * gates the page behind auth.
 */
export async function getInstallPaymentsForCurrentSession(): Promise<InstallPaymentsFile> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (typeof tenantId !== 'number') {
    throw new Error(
      '[lib/install-payments-data] getInstallPaymentsForCurrentSession called without a tenant-bound session.',
    );
  }
  return getInstallPayments(tenantId);
}
