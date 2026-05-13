import 'server-only';
import {
  RoofLinkJobSchema,
  WriteOffsFileSchema,
  type RoofLinkJob,
  type WriteOffRecord,
  type WriteOffsFile,
} from '@vera/types';
import { isInARWorkingSet, toWriteOffRecord } from '@vera/domain';
import writeOffsJson from '@/data/write-offs.json';
import {
  getLiveJobs,
  getLiveLineItems,
  promotedVersionIds,
} from './backfill/merge-view';
import { auth } from './auth';

/**
 * Source-of-truth for the Write-offs dashboard. Two paths, same shape as the
 * metrics dispatcher in `lib/data.ts`:
 *
 *   - **JSON path** (default) — parse the build-time `write-offs.json`
 *     snapshot produced by `scripts/fetch-write-offs.ts`.
 *
 *   - **DB path** (`USE_DB_DATA_SOURCE=1`) — join the latest promoted
 *     RawRooflinkJob rows (AR working set, filtered down) against the
 *     promoted RawRooflinkLineItems rows for the same tenant, run
 *     `toWriteOffRecord` from `@vera/domain` to keep detection logic in one
 *     place, and aggregate totals at request time. Cached per
 *     `(tenantId, jobs-version, lineitems-version)`.
 *
 * Single feature flag (`USE_DB_DATA_SOURCE`) gates both this and the metrics
 * cutover so rollback is one toggle.
 */

// ---------------------------------------------------------------------------
// JSON path — unchanged behavior; the snapshot is bundled at build time.
// ---------------------------------------------------------------------------

let jsonCache: WriteOffsFile | null = null;

function getWriteOffsFromJson(): WriteOffsFile {
  if (jsonCache) return jsonCache;
  jsonCache = WriteOffsFileSchema.parse(writeOffsJson);
  return jsonCache;
}

// ---------------------------------------------------------------------------
// DB path — request-time read with per-(tenant, versions) cache.
// ---------------------------------------------------------------------------

interface DbCacheSlot {
  versionKey: string;
  data: WriteOffsFile;
}

const dbCache = new Map<number, DbCacheSlot>();

async function getWriteOffsFromDb(tenantId: number): Promise<WriteOffsFile> {
  // CHEAP cache-key probe first: pull just the promoted-run-id lists for
  // both sources before any heavy fetch. Keeps cache hits at ~10ms.
  const [jobIds, lineItemsIds] = await Promise.all([
    promotedVersionIds(tenantId, 'rooflink_jobs'),
    promotedVersionIds(tenantId, 'rooflink_lineitems'),
  ]);
  const versionKey = `${jobIds.join(',')}|${lineItemsIds.join(',')}`;

  const cached = dbCache.get(tenantId);
  if (cached && cached.versionKey === versionKey) return cached.data;

  // Cache miss — do the heavy work.
  const [jobRows, lineItemsRows] = await Promise.all([
    getLiveJobs(tenantId),
    getLiveLineItems(tenantId),
  ]);

  // Build a payload lookup keyed by estimateId. Line-item rows store their
  // natural key separately from the payload, so we don't have to dig into
  // the payload to index.
  const payloadByEstimateId = new Map<string, unknown>();
  for (const row of lineItemsRows) {
    payloadByEstimateId.set(row.estimateId, row.payload);
  }

  // Filter to the AR working set and project each (job, payload) pair into
  // a WriteOffRecord. Jobs without a primary_estimate.id or without an
  // Amount Withheld discount return null and are skipped.
  const records: WriteOffRecord[] = [];
  let candidatesFetched = 0;
  let fetchErrors = 0;
  let skipped404 = 0;

  for (const row of jobRows) {
    const parsed = RoofLinkJobSchema.safeParse(row.payload);
    if (!parsed.success) continue;
    const job: RoofLinkJob = parsed.data;
    if (!isInARWorkingSet(job)) continue;

    const estimateId = job.primary_estimate?.id;
    if (estimateId == null) continue;

    candidatesFetched += 1;
    const payload = payloadByEstimateId.get(String(estimateId));
    if (payload == null) {
      // No line-items row for this estimate yet — analogous to a 404 from
      // the seed script. The estimate exists but we haven't fetched its
      // breakdown into the DB. Count it so the dashboard surface can flag
      // partial coverage.
      skipped404 += 1;
      continue;
    }

    const record = toWriteOffRecord(job, payload);
    if (record) records.push(record);
  }

  records.sort((a, b) => b.amountWithheld - a.amountWithheld);

  const totalAmountWithheld = records.reduce((s, r) => s + r.amountWithheld, 0);

  const data: WriteOffsFile = WriteOffsFileSchema.parse({
    generatedAt: new Date().toISOString(),
    scope: 'ar-working-set',
    totals: {
      candidatesFetched,
      candidatesWithWriteOffs: records.length,
      totalAmountWithheld,
      fetchErrors,
      skipped404,
    },
    records,
  });

  dbCache.set(tenantId, { versionKey, data });
  return data;
}

/**
 * Drop any cached write-offs snapshot for a tenant. Called by the backfill
 * tick worker after a successful promote on either source so the next
 * request recomputes.
 */
export function invalidateWriteOffsSnapshot(tenantId: number): void {
  dbCache.delete(tenantId);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function isDbPathEnabled(): boolean {
  return process.env.USE_DB_DATA_SOURCE === '1';
}

export async function getWriteOffs(tenantId: number): Promise<WriteOffsFile> {
  if (isDbPathEnabled()) return getWriteOffsFromDb(tenantId);
  return getWriteOffsFromJson();
}

/**
 * Session-aware variant for the write-offs server page. Same defense-in-depth
 * shape as `getDataForCurrentSession` in `lib/data.ts` — the dashboard
 * middleware already gates the page.
 */
export async function getWriteOffsForCurrentSession(): Promise<WriteOffsFile> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (typeof tenantId !== 'number') {
    throw new Error(
      '[lib/write-offs-data] getWriteOffsForCurrentSession called without a tenant-bound session.',
    );
  }
  return getWriteOffs(tenantId);
}
