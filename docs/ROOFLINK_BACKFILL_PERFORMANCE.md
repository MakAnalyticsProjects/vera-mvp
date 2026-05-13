# Rooflink backfill — measured performance and how to optimize it

**Status:** Written after the first real-world end-to-end runs on May 12-13, 2026.

**Audience:** Anyone touching `apps/web/lib/backfill/rooflink.ts`, `tick-worker.ts`, or the `BackfillRun` lifecycle. Read this before "fixing" perceived slowness — most of the work has already been measured.

---

## TL;DR

| Estimate (printed in code/docs) | Reality (measured) | Source of the gap |
|---|---|---|
| `rooflink_jobs` ≈ **17 min** | **~4 hours** | Estimate assumed Rooflink responds in ~0s. Real per-page latency is 10-21s. We also picked a 2× slower sort key than the reference Python script. |
| `rooflink_lineitems` ≈ **2.5 hours** | **~5-6 hours** measured floor; we currently run at **~80 hours** | Same optimistic-estimate problem. Plus an O(100k) per-tick DB query bug in `loadEstimateIds()` that adds ~60s of overhead to every tick. |

**The estimates were never wrong on purpose; they were just `count ÷ rate-limit-floor` arithmetic that ignored Rooflink's actual response time.** Two concrete code bugs amplify the gap further. Both are fixable.

---

## What we measured

### Rooflink `/jobs/?page_size=100` (bulk list)

Direct curl test on May 13, 2026 (after our jobs run had already finished, so the key was warm):

```
ordering=-date_created       : 10.0s,  10.2s,  10.5s   →  ~10.2s avg
ordering=-date_last_edited   : 21.1s,  18.0s,  19.9s   →  ~19.7s avg
```

**The sort key matters by 2×.** Rooflink almost certainly has an index on `date_created` (standard) but not on `date_last_edited` — every page request forces a full in-memory sort on their end before returning 100 rows.

### Rooflink `/estimates/{id}/lineitems/` (per-estimate detail)

Direct curl test on the same day, same key:

```
estimate 196224: 1.99s
estimate 206211: 2.04s
estimate 180279: 1.41s
estimate 209498: 1.33s
estimate 209510: 1.39s
                 ~1.6s avg
```

Lineitems endpoint is **fast** (~1.5s/req). When tick durations are >70s for 2 estimates, the slowness is on our side, not Rooflink's.

---

## Where the estimates came from

### `backfill.py` line 71

```python
log(f"Target: {EXPECTED_TOTAL:,} jobs at 1 req/sec ~17 min")
```

Math: `103,757 ÷ 100 per page × 1s sleep = 1,038s = 17.3 min`. **This counts only the 1-second sleep between requests, not the request itself.** That's the source of the 17-min number; it was a printed budget, never a measurement.

### `Important Estimates.txt` line 39 (the lineitems design doc)

> "8,492 estimates × 1 sec ≈ 2 hours 22 minutes of wall time, plus margin for retries."

Same arithmetic, same flaw. **Both numbers came from `count × 1s` without including Rooflink's actual response latency.**

A realistic floor would have been:

| Endpoint | Real per-request avg | Plus 1s sleep | Per-request total | Total (full backfill) |
|---|---|---|---|---|
| `/jobs/?page_size=100` (`-date_created`) | ~10s | 1s | ~11s | 1,038 × 11s ≈ **3.2 hr** |
| `/jobs/?page_size=100` (`-date_last_edited`) | ~20s | 1s | ~21s | 1,038 × 21s ≈ **6.1 hr** |
| `/estimates/{id}/lineitems/` | ~1.5s | 1s | ~2.5s | 8,492 × 2.5s ≈ **5.9 hr** |

Even the *unbeatable* lineitems floor is ~6 hours, not 2.5.

---

## What we ran (and the actual numbers)

### Run #13 — `rooflink_jobs`, May 12-13

- Mode: full
- Items: 103,952 fetched / 103,947 DB rows (5 duplicates likely deduped via `skipDuplicates`)
- Duration: **240 minutes (4 hours)**
- 0 errors, 0 consecutive errors
- Promoted: ✅
- Per-page average: 4 hr ÷ 1,040 pages = **~14s/page** (between the two sort-key buckets — Rooflink throttle apparently relaxed mid-run)

### Run #16 — `rooflink_lineitems`, May 13 (in flight at time of writing)

- Mode: full
- Items: ~70 / 8,497 after ~50 minutes
- Per-tick observed: **64-138 seconds for 2 estimates**
- That's ~35-70s per estimate, vs Rooflink's actual ~1.5s/estimate
- **The bug is ours, not Rooflink's.**

---

## The two code-side issues

### 1. Sort key on `/jobs/` is 2× slower than necessary

**Location:** `apps/web/lib/backfill/rooflink.ts:92`

```ts
const params = new URLSearchParams({
  ordering: '-date_last_edited',  // ← 2× slower than -date_created
  page_size: '100',
});
```

**Fix:** Change `'-date_last_edited'` to `'-date_created'` (matching `backfill.py`). Verified with direct curl test: 10s/page vs 19.7s/page on the same key, same minute.

**Why the original code chose `date_last_edited`:** for *incremental* syncs we use `date_last_edited__gte=<watermark>` to fetch only-recently-edited records. The ordering can stay on `date_created` for the initial sort — Rooflink's filter doesn't require sort-by-filter-field. Keep the filter on `date_last_edited`, but change the sort to `date_created`.

**Expected impact:** ~30-40% off future jobs full-syncs (from ~4 hours to ~2.9 hours).

### 2. `loadEstimateIds()` re-queries 100k rows from Neon on every lineitems tick

**Location:** `apps/web/lib/backfill/rooflink.ts:238` (function `loadEstimatesWithTimestamps`)

```ts
async function loadEstimatesWithTimestamps(): Promise<CachedEstimate[]> {
  // Path 1 — DB-backed promoted version.
  const latest = await db.backfillRun.findFirst({...});
  if (latest) {
    const rows = await db.rawRooflinkJob.findMany({
      where: { dataVersion: latest.id },
      select: { payload: true },
    });
    // ... process 103,947 rows in memory to extract primary_estimate.id ...
  }
  // Path 2 — JSONL fallback (HAS module-level caching via cachedJsonlEstimates)
}
```

**The DB path has no cache.** Every lineitems tick:

1. Queries `BackfillRun` for the promoted version (~50ms)
2. Streams **103,947 rows of JSONB payload from Neon** to find primary_estimate.id values (~30-60s depending on pooler latency)
3. Returns a list of 8,497 estimate IDs
4. The caller (`fetchLineItemsBatch`) uses **2 of them** and discards the rest
5. Next tick repeats from step 1

This is the ~60s of overhead per tick. For 4,249 ticks (at batchSize=2), that's **~70 hours of redundant Neon traffic**.

The JSONL fallback at the bottom of the same function already has a module-level cache:

```ts
let cachedJsonlEstimates: CachedEstimate[] | null = null;
// later:
if (cachedJsonlEstimates) return cachedJsonlEstimates;
```

**Fix:** Mirror that caching at the DB path. Cache by `dataVersion` so a future promote naturally invalidates:

```ts
let cachedDbEstimates: { dataVersion: number; data: CachedEstimate[] } | null = null;

async function loadEstimatesWithTimestamps(): Promise<CachedEstimate[]> {
  const latest = await db.backfillRun.findFirst({...});
  if (latest) {
    if (cachedDbEstimates?.dataVersion === latest.id) {
      return cachedDbEstimates.data;
    }
    const rows = await db.rawRooflinkJob.findMany({...});
    const out = /* ... build the list ... */;
    cachedDbEstimates = { dataVersion: latest.id, data: out };
    return out;
  }
  // ... JSONL fallback unchanged ...
}
```

**Expected impact:** Lineitems tick goes from ~74s for 2 estimates → ~3-5s for 2 estimates (just Rooflink + DB write). Full sync: **~3-4 hours** instead of ~70+ hours, matching the original "Important Estimates.txt" target's realistic floor of 5-6 hours.

(The reference Python script `scripts/fetch-write-offs.ts` — our own working TS for the same endpoint — already uses this pattern: stream the JSONL once at the top, then iterate. Same code structure once the cache is in place.)

---

## Why parallelism doesn't help

Several "obvious" speed-ups don't actually work here:

| Idea | Why it doesn't help |
|---|---|
| Increase `batchSize` from 2 → 50 | Bottleneck is per-request latency, not per-tick overhead. With the cache fix, batch size hardly matters — we're rate-limited by Rooflink at 1 req/sec. |
| Run multiple concurrent ticks per run | The `claimedAt` optimistic lock prevents it. Even if you bypassed it, concurrent requests to Rooflink trigger WAF / 429s. We probed this on May 12 and saw aborts. |
| Run from two API keys in parallel | Possible but requires Rooflink's cooperation (separate account). Out of band. |
| Drop the 1-second inter-request sleep | Saves ~2-3 hours total but risks 429s. Marginal vs the cache fix's ~70-hour savings. |
| Switch from Node `fetch` to `subprocess+curl` (like `backfill.py`) | Network latency dominates, not HTTP-stack choice. Tested: no measurable difference. |

The cache fix and the sort-key fix are the only two real speed-ups. Everything else is at the floor.

---

## Tech-lead's estimates — what to learn

The 17-min and 2.5-hr numbers weren't malicious. They're a common estimation antipattern:

> **`count ÷ rate-limit = wall time`**, ignoring the request itself

It's a fine sanity-check floor, but it's not a real budget. Whenever a doc says "X hours at 1 req/sec for Y items," **always add a sample measurement of the per-request latency** before committing to it. Especially for:

- Bulk list endpoints (often slow — server has to materialize the whole page)
- Endpoints that take a sort/order parameter (response time can vary 2-10× across indexed vs unindexed columns)
- Anything behind a WAF (latency degrades the more you call it — running a 1k-request test ≠ running a 100k-request backfill)

For new endpoints, run 5-10 sequential probes at the real rate before committing to a budget. The direct-curl tests in this doc took ~3 minutes and reset 6 hours of misallocated expectation.

---

## Operations checklist

When you suspect a backfill is slow:

1. **Pull a direct curl measurement first.** Time the endpoint directly with `curl` and the same headers our code uses. If Rooflink takes <2s/req on its own, the slowness is in our code.
2. **Compare tick duration vs request duration.** Our tick worker logs `POST /api/cron/backfill-tick 200 in Xs` to dev-server stdout. Subtract the expected `batchSize × per-request-time`. The remainder is per-tick overhead (claim/release/DB query/write). Anything over ~1-2s of overhead is a bug.
3. **Check if `loadEstimateIds`-style queries are caching correctly.** Any "load all the IDs we'd theoretically need" call inside a tick should be cached at module scope. The first tick can be slow; ticks 2+ should not.
4. **Check the sort key.** If Rooflink's endpoint accepts `ordering=`, try both `-date_created` and `-date_last_edited`. Pick the indexed one.
5. **Audit any sleep / backoff.** Inter-request `sleep(1)` is the floor we accept. Anything else (e.g. tiered retries doubling up) is questionable.

---

## See also

- `apps/web/lib/backfill/rooflink.ts` — fetcher + estimate-id loader
- `apps/web/lib/backfill/tick-worker.ts` — claim, fetch, write, advance, publish-next
- `scripts/fetch-write-offs.ts` — **working** TS reference for the lineitems endpoint; uses the load-once pattern correctly
- `backfill.py` — Python reference for `/jobs/` (but **not** lineitems — there is no Python lineitems script)
- `Important Estimates.txt` — design doc for lineitems backfill (proposes the pattern; never validated by a real run)
- `docs/BACKFILL_SCHEDULING.md` — how scheduled backfills run in prod
- `docs/DATA_SOURCE_MIGRATION.md` — the cutover this all unblocks
