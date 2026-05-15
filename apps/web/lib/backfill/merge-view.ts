import 'server-only';
import { db } from '@/lib/db';
import type { BackfillSource } from './sources';

/**
 * Merge view — "the latest live snapshot" of a Rooflink source.
 *
 * Read architecture (post LiveJob materialized view, 2026-05-15):
 *   • `getLiveARJobsWithContext` and `getLiveJobsForWriteOffs` read from
 *     the `LiveJob` materialized view (see `prisma/migrations/2026.../
 *     add_livejob_materialized_view`). LiveJob holds one row per
 *     (tenantId, rooflinkId), already deduplicated across the promoted
 *     run chain, with the AR/write-offs filter fields and the
 *     duplicate-address count extracted as proper columns + indexes.
 *     The hot read path is a partial-index lookup — no JSONB parsing.
 *   • `getLiveJobs` / `getLiveLineItems` still go directly against
 *     `RawRooflinkJob` / `RawRooflinkLineItems` with a `DISTINCT ON` —
 *     they're used by backfill diagnostics and the line-items join, not
 *     by the user-facing dashboard hot path.
 *
 * Refresh: the tick worker calls `REFRESH MATERIALIZED VIEW CONCURRENTLY
 * "LiveJob"` after each non-empty `rooflink_jobs` promote (see
 * `tick-worker.ts → promote()`). CONCURRENTLY keeps the view readable
 * during the refresh.
 *
 * If LiveJob ever needs to be reshaped, the definition lives in one
 * place: the migration SQL. RawRooflinkJob remains the source of truth,
 * so drop-and-recreate of LiveJob is safe and loses no data.
 */

export interface RawJobRow {
  rooflinkId: string;
  dataVersion: number;
  payload: unknown;
  fetchedAt: Date;
}

export interface RawLineItemsRow {
  estimateId: string;
  dataVersion: number;
  payload: unknown;
  fetchedAt: Date;
}

/** A row from {@link getLiveARJobsWithContext}: an AR-eligible job plus the
 * cross-population context the domain transform needs (currently just the
 * duplicate-address count, since that's the only anomaly that crosses jobs).
 *
 * The SQL applies the AR working-set filter (`isInARWorkingSet` from
 * `@vera/domain/classification`) so the result is already narrowed — Node
 * never sees the ~120,000-row full population. */
export interface ARJobContextRow {
  payload: unknown;
  addressCount: number;
  fetchedAt: Date;
}

/** A row from {@link getLiveJobsForWriteOffs}: a job that has a
 * primary_estimate.id AND a non-null `date_completed` >= `installDateCutoff`.
 * Drops the ~120k-row population to ~400 rows server-side. */
export interface WriteOffJobRow {
  payload: unknown;
  fetchedAt: Date;
}

/**
 * Fetch the latest live snapshot of rooflink_jobs as one row per rooflinkId.
 * Returns all jobs in the current snapshot — caller is expected to filter
 * downstream.
 */
export async function getLiveJobs(tenantId: number): Promise<RawJobRow[]> {
  const promotedVersions = await promotedVersionIds(tenantId, 'rooflink_jobs');
  if (promotedVersions.length === 0) return [];
  // DISTINCT ON in raw SQL — Prisma's findMany can't express "highest
  // dataVersion per rooflinkId" in one query.
  return db.$queryRaw<RawJobRow[]>`
    SELECT DISTINCT ON ("rooflinkId")
      "rooflinkId", "dataVersion", payload, "fetchedAt"
    FROM "RawRooflinkJob"
    WHERE "dataVersion" = ANY(${promotedVersions})
    ORDER BY "rooflinkId", "dataVersion" DESC
  `;
}

/**
 * Fetch the latest live snapshot of rooflink_lineitems as one row per
 * estimateId. Same merge semantics as getLiveJobs.
 */
export async function getLiveLineItems(tenantId: number): Promise<RawLineItemsRow[]> {
  const promotedVersions = await promotedVersionIds(tenantId, 'rooflink_lineitems');
  if (promotedVersions.length === 0) return [];
  return db.$queryRaw<RawLineItemsRow[]>`
    SELECT DISTINCT ON ("estimateId")
      "estimateId", "dataVersion", payload, "fetchedAt"
    FROM "RawRooflinkLineItems"
    WHERE "dataVersion" = ANY(${promotedVersions})
    ORDER BY "estimateId", "dataVersion" DESC
  `;
}

/**
 * AR working-set snapshot, read from the LiveJob materialized view.
 *
 * LiveJob is one row per (tenantId, rooflinkId), already deduped across the
 * promoted version chain. The AR filter columns (`dateCompleted`, `balance`,
 * `excludeFromQb`) and the duplicate-address count (`addressDupCount`) are
 * stored as proper columns, so this query is a pure partial-index lookup —
 * no JSONB parsing on the hot path, no DISTINCT ON, no cross-row aggregation.
 *
 * Measured: ~1 ms cold (vs ~1200 ms reading from RawRooflinkJob via JSONB).
 * The cost shifted to `REFRESH MATERIALIZED VIEW CONCURRENTLY "LiveJob"` in
 * `tick-worker.ts → promote()`, which runs on the backfill worker, off the
 * user-facing request path.
 *
 * NB: the AR filter logic MUST stay in sync with
 * `shared/domain/src/classification.ts → isInARWorkingSet`. If that function
 * changes, the partial-index predicate in the migration changes too.
 */
export async function getLiveARJobsWithContext(
  tenantId: number,
): Promise<ARJobContextRow[]> {
  return db.$queryRaw<ARJobContextRow[]>`
    SELECT
      payload,
      "addressDupCount" AS "addressCount",
      "fetchedAt"
    FROM "LiveJob"
    WHERE "tenantId" = ${tenantId}
      AND "dateCompleted" IS NOT NULL
      AND balance > 0
      AND "excludeFromQb" = false
  `;
}

/**
 * Write-offs snapshot, narrowed in SQL.
 *
 * The write-offs dashboard scope is "all-estimates with install_date >=
 * cutoff" — broader than the AR working set (per the May 13 broadening), but
 * still much narrower than the full 120k-row population. Pushes the date
 * cutoff and the `primary_estimate.id IS NOT NULL` filter into Postgres so we
 * transfer ~400-500 rows instead of all 120k.
 *
 * `installDateCutoff` should match the `INSTALL_DATE_CUTOFF` constant in
 * `apps/web/lib/write-offs-data.ts` so the two scopes agree.
 */
export async function getLiveJobsForWriteOffs(
  tenantId: number,
  installDateCutoff: string | null,
): Promise<WriteOffJobRow[]> {
  // Read from LiveJob: one row per (tenant, rooflinkId), with the write-offs
  // filter columns (`primaryEstimateId`, `dateCompleted`) extracted. The
  // partial index `LiveJob_writeoff_partial_idx` makes the predicate a
  // pure index lookup.
  return db.$queryRaw<WriteOffJobRow[]>`
    SELECT payload, "fetchedAt"
    FROM "LiveJob"
    WHERE "tenantId" = ${tenantId}
      AND "primaryEstimateId" IS NOT NULL
      AND (
        ${installDateCutoff}::text IS NULL
        OR (
          "dateCompleted" IS NOT NULL
          AND "dateCompleted" >= ${installDateCutoff}::date
        )
      )
  `;
}

/**
 * Promoted run IDs for a (tenant, source). Always includes the most recent
 * full sync plus any later incrementals on top — i.e., the snapshot chain
 * that constitutes "live".
 *
 * If there's a full sync at run #10 and incrementals at #11, #12, #13, all
 * with promoted=true, this returns [10, 11, 12, 13]. The DISTINCT ON in
 * getLive* picks the latest version per record.
 */
export async function promotedVersionIds(
  tenantId: number,
  source: BackfillSource,
): Promise<number[]> {
  const rows = await db.backfillRun.findMany({
    where: {
      tenantId,
      source,
      promoted: true,
      status: 'completed',
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((r) => r.id);
}
