import 'server-only';
import { db } from '@/lib/db';
import { RoofLinkJobSchema, type RoofLinkJob } from '@vera/types';

/**
 * Builds the data payload that backs the post-sync PDF attached to the
 * "sync completed" email (see `lib/backfill/tick-worker.ts`).
 *
 * Two source families share one shape so the PDF template can render either.
 * Rows written by this run are identified by `dataVersion = run.id` — the
 * tick worker tags every raw row with the run that fetched it.
 *
 * For full syncs of `rooflink_jobs` the touched-row set is the entire snapshot
 * (~100k rows), which is impractical to enumerate. We cap at PDF_RECORD_CAP
 * top-balance jobs and surface a truncation footer.
 */

export const PDF_RECORD_CAP = 200;
const QUERY_FETCH_LIMIT = 500;

export type SyncSource = 'rooflink_jobs' | 'rooflink_lineitems';

export interface SyncSummaryJobRow {
  rooflinkId: string;
  jobNumber: number | null;
  address: string;
  customerName: string | null;
  dateCompleted: string | null;
  balance: number | null;
  gtPrice: number | null;
}

export interface SyncSummaryLineItemsRow {
  estimateId: string;
  workDoingCount: number;
  discountsCount: number;
  workDoingTotal: number | null;
}

export interface SyncSummaryData {
  source: SyncSource;
  sourceFriendly: string;
  runId: number;
  mode: 'full' | 'incremental';
  modeFriendly: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationLabel: string;
  itemsProcessed: number;
  itemsTotal: number | null;
  shownCount: number;
  truncated: boolean;
  jobRows: SyncSummaryJobRow[];
  lineItemsRows: SyncSummaryLineItemsRow[];
}

const SOURCE_LABEL: Record<SyncSource, string> = {
  rooflink_jobs: 'Rooflink jobs',
  rooflink_lineitems: 'Rooflink estimate line items',
};

interface RawJobRow {
  rooflinkId: string;
  payload: unknown;
}

interface RawLineItemsRow {
  estimateId: string;
  payload: unknown;
}

interface LineItemsPayloadShape {
  work_doing?: Array<{ rcv?: number | null; price?: number | null }>;
  discounts?: unknown[];
}

function projectJobRow(rooflinkId: string, raw: unknown): SyncSummaryJobRow | null {
  const parsed = RoofLinkJobSchema.safeParse(raw);
  if (!parsed.success) return null;
  const job: RoofLinkJob = parsed.data;
  return {
    rooflinkId,
    jobNumber: job.number ?? null,
    address: job.full_address ?? job.address ?? '',
    customerName: job.customer?.name ?? null,
    dateCompleted: job.date_completed ?? null,
    balance: job.primary_estimate?.balance ?? null,
    gtPrice: job.primary_estimate?.gt_price ?? null,
  };
}

function projectLineItemsRow(estimateId: string, raw: unknown): SyncSummaryLineItemsRow {
  const payload = (raw ?? {}) as LineItemsPayloadShape;
  const workDoing = Array.isArray(payload.work_doing) ? payload.work_doing : [];
  const discounts = Array.isArray(payload.discounts) ? payload.discounts : [];
  const total =
    workDoing.length === 0
      ? null
      : workDoing.reduce((sum, item) => {
          const v = typeof item?.rcv === 'number' ? item.rcv : 0;
          return sum + v;
        }, 0);
  return {
    estimateId,
    workDoingCount: workDoing.length,
    discountsCount: discounts.length,
    workDoingTotal: total,
  };
}

function formatDurationLabel(startedAt: Date | null, finishedAt: Date | null): string {
  if (!startedAt || !finishedAt) return 'unknown';
  const sec = Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000);
  if (sec < 1) return 'under a second';
  if (sec < 60) return `${sec} ${sec === 1 ? 'second' : 'seconds'}`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem === 0 ? `${min} ${min === 1 ? 'minute' : 'minutes'}` : `${min}m ${rem}s`;
}

/**
 * Read up to QUERY_FETCH_LIMIT rows written by this run, project them into
 * a slim row shape, and trim to PDF_RECORD_CAP for the PDF. Returns null
 * when the run produced zero touched rows (the caller skips PDF for those).
 */
export async function buildSyncSummaryData(runId: number): Promise<SyncSummaryData | null> {
  const run = await db.backfillRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      source: true,
      mode: true,
      itemsProcessed: true,
      itemsTotal: true,
      startedAt: true,
      finishedAt: true,
    },
  });
  if (!run) return null;
  if (run.source !== 'rooflink_jobs' && run.source !== 'rooflink_lineitems') return null;

  const source = run.source;
  const sourceFriendly = SOURCE_LABEL[source];
  const mode: 'full' | 'incremental' = run.mode === 'incremental' ? 'incremental' : 'full';

  const base: Omit<SyncSummaryData, 'jobRows' | 'lineItemsRows' | 'shownCount' | 'truncated'> = {
    source,
    sourceFriendly,
    runId: run.id,
    mode,
    modeFriendly: mode === 'incremental' ? 'Incremental sync' : 'Full sync',
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    durationLabel: formatDurationLabel(run.startedAt, run.finishedAt),
    itemsProcessed: run.itemsProcessed,
    itemsTotal: run.itemsTotal,
  };

  if (run.itemsProcessed === 0) return null;

  if (source === 'rooflink_jobs') {
    const rows = await db.$queryRaw<RawJobRow[]>`
      SELECT "rooflinkId", payload
      FROM "RawRooflinkJob"
      WHERE "dataVersion" = ${run.id}
      ORDER BY "fetchedAt" DESC
      LIMIT ${QUERY_FETCH_LIMIT}
    `;
    const projected: SyncSummaryJobRow[] = [];
    for (const r of rows) {
      const row = projectJobRow(r.rooflinkId, r.payload);
      if (row) projected.push(row);
    }
    projected.sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));
    const shown = projected.slice(0, PDF_RECORD_CAP);
    return {
      ...base,
      jobRows: shown,
      lineItemsRows: [],
      shownCount: shown.length,
      truncated: run.itemsProcessed > shown.length,
    };
  }

  const rows = await db.$queryRaw<RawLineItemsRow[]>`
    SELECT "estimateId", payload
    FROM "RawRooflinkLineItems"
    WHERE "dataVersion" = ${run.id}
    ORDER BY "fetchedAt" DESC
    LIMIT ${QUERY_FETCH_LIMIT}
  `;
  const projected = rows.map((r) => projectLineItemsRow(r.estimateId, r.payload));
  projected.sort((a, b) => (b.workDoingTotal ?? 0) - (a.workDoingTotal ?? 0));
  const shown = projected.slice(0, PDF_RECORD_CAP);
  return {
    ...base,
    jobRows: [],
    lineItemsRows: shown,
    shownCount: shown.length,
    truncated: run.itemsProcessed > shown.length,
  };
}
