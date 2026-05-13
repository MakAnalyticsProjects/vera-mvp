import 'server-only';
import {
  GeneratedDataSchema,
  RoofLinkJobSchema,
  type GeneratedData,
  type RoofLinkJob,
} from '@vera/types';
import { isInARWorkingSet, repRollups, toARJob } from '@vera/domain';
import generatedJson from '@/data/generated.json';
import { getLiveJobs, promotedVersionIds } from './backfill/merge-view';
import { auth } from './auth';

/**
 * Source-of-truth for the metrics dashboard. Two paths:
 *
 *   - **JSON path** (default) — parse the build-time `generated.json` snapshot.
 *     Same behavior the dashboard has shipped with since day one. Tenant-
 *     agnostic; the snapshot represents the single demo tenant.
 *
 *   - **DB path** (`USE_DB_DATA_SOURCE=1`) — read the latest promoted
 *     RawRooflinkJob rows for `tenantId` via `getLiveJobs`, run the same
 *     domain transform the preprocess uses (`toARJob`), and return the same
 *     `GeneratedData` shape. Cached per-`(tenantId, promotedRunIds)` so a
 *     promote bust naturally invalidates the cache.
 *
 * Routes call `await getData(tenantId)`. The dispatcher picks the path.
 * Once the cutover is verified in prod, the JSON path and the flag will be
 * removed in a follow-up.
 */

// ---------------------------------------------------------------------------
// JSON path — unchanged behavior; the snapshot is bundled at build time.
// ---------------------------------------------------------------------------

let jsonCache: GeneratedData | null = null;

function getDataFromJson(): GeneratedData {
  if (jsonCache) return jsonCache;
  jsonCache = GeneratedDataSchema.parse(generatedJson);
  return jsonCache;
}

// ---------------------------------------------------------------------------
// DB path — request-time read with per-(tenant, promoted-run-ids) cache.
// ---------------------------------------------------------------------------

interface DbCacheSlot {
  /** Stable string derived from the promoted-run-ids list for this tenant. */
  versionKey: string;
  data: GeneratedData;
}

const dbCache = new Map<number, DbCacheSlot>();

/**
 * Build an address-occurrence map from the full parsed Rooflink population
 * (not just the AR working set). The duplicate-address anomaly relies on
 * counting across the entire dataset — matches `scripts/preprocess.ts`.
 */
function computeAddressCounts(parsedJobs: RoofLinkJob[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const job of parsedJobs) {
    const addr = (job.full_address ?? job.address ?? '').trim().toLowerCase();
    if (addr) counts.set(addr, (counts.get(addr) ?? 0) + 1);
  }
  return counts;
}

/**
 * Read the latest promoted rooflink_jobs snapshot from the DB, run the
 * preprocess transform at request time, and return the same `GeneratedData`
 * shape the JSON path produces. Cached per tenant; cache key is the
 * concatenated promoted-run-id list so any promote (full or incremental)
 * naturally invalidates the slot.
 */
async function getDataFromDb(tenantId: number): Promise<GeneratedData> {
  // CHEAP cache-key probe first: pull just the promoted-run-id list (a
  // small `SELECT id FROM BackfillRun WHERE promoted=true` — milliseconds)
  // and compare against the cached version before any heavy fetch. This
  // keeps cache hits at ~10ms instead of paying the multi-second cost of
  // pulling 100k+ raw payloads on every request.
  const promotedIds = await promotedVersionIds(tenantId, 'rooflink_jobs');
  const versionKey = promotedIds.join(',');

  const cached = dbCache.get(tenantId);
  if (cached && cached.versionKey === versionKey) return cached.data;

  // Cache miss — do the heavy work.
  const rawRows = await getLiveJobs(tenantId);
  const now = new Date();

  // Parse every payload — anything that fails the schema is dropped (the
  // preprocess pipeline does the same with `safeParse + continue`). Counting
  // parse failures here is unnecessary noise; the merge view returns a
  // bounded set and verification at backfill-time catches structural drift.
  const parsedJobs: RoofLinkJob[] = [];
  for (const row of rawRows) {
    const parsed = RoofLinkJobSchema.safeParse(row.payload);
    if (parsed.success) parsedJobs.push(parsed.data);
  }

  // Address counts span the FULL parsed population, not just AR jobs —
  // matches preprocess.ts:60 so the duplicate-address anomaly fires
  // identically.
  const addressCounts = computeAddressCounts(parsedJobs);
  const arJobs = parsedJobs
    .filter(isInARWorkingSet)
    .map((job) => toARJob(job, { addressCounts, now }));

  const totalAR = arJobs.reduce((sum, j) => sum + j.balance, 0);
  const reps = repRollups(arJobs);

  const data: GeneratedData = GeneratedDataSchema.parse({
    generatedAt: new Date().toISOString(),
    asOf: now.toISOString(),
    jobCount: arJobs.length,
    totalAR,
    jobs: arJobs,
    reps,
  });

  dbCache.set(tenantId, { versionKey, data });
  return data;
}

/**
 * Drop any cached DB snapshot for a tenant. Called by the backfill tick
 * worker right after a successful promote so the next request recomputes
 * from fresh DB rows. No-op for the JSON path.
 */
export function invalidateDataSnapshot(tenantId: number): void {
  dbCache.delete(tenantId);
}

// ---------------------------------------------------------------------------
// Dispatcher — every route calls `await getData(tenantId)`.
// ---------------------------------------------------------------------------

function isDbPathEnabled(): boolean {
  return process.env.USE_DB_DATA_SOURCE === '1';
}

export async function getData(tenantId: number): Promise<GeneratedData> {
  if (isDbPathEnabled()) return getDataFromDb(tenantId);
  return getDataFromJson();
}

/**
 * Session-aware variant for dashboard server components. Middleware already
 * gates `/dashboard/*` behind auth, so by the time this runs we're guaranteed
 * a session — the throw is defense-in-depth, not a UX path. API routes
 * should NOT use this; they use `withAuth(...)` + `getData(tenantId)` so the
 * audit context is set in the same scope.
 */
export async function getDataForCurrentSession(): Promise<GeneratedData> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (typeof tenantId !== 'number') {
    throw new Error(
      '[lib/data] getDataForCurrentSession called without a tenant-bound session — ' +
        'check middleware coverage for this route.',
    );
  }
  return getData(tenantId);
}
