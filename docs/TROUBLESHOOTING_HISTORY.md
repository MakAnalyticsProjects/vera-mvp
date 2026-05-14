# Vera — Troubleshooting history

Postmortems for the gotchas we've actually hit. Each entry documents the
**diagnosis**, not just the fix — so when the same shape of problem
shows up again, the next person can resolve it in minutes instead of
hours.

> Last updated: 2026-05-14

---

## 1. Auth.js middleware bundle exceeded Edge Function 1 MB limit

**Date:** 2026-05-08 (during initial prod deploy of multi-tenant auth)

**Symptom:**
```
Error: The Edge Function "_middleware" size is 1.02 MB and your plan
size limit is 1 MB.
```
`vercel --prod` failed at the deploy step. Build succeeded.

**Diagnosis:** `apps/web/middleware.ts` was importing `auth` from
`@/lib/auth.ts`. That file imported `db` from `@/lib/db.ts`, which in
turn imports the full Prisma client. Result: the entire Prisma runtime
got bundled into the Edge runtime. Prisma alone is hundreds of KB.

**Fix:** Standard Auth.js v5 split-config pattern.

- `lib/auth.config.ts` — edge-safe. Provider list, pages config, JWT
  strategy. No DB. Tiny bundle.
- `lib/auth.ts` — full config. Spreads `authConfig` and adds the
  DB-touching `signIn` / `jwt` / `session` callbacks. Used by API routes
  and server components, NEVER by middleware.
- `middleware.ts` — uses `NextAuth(authConfig).auth()` directly via the
  edge-safe config.

After the split, middleware bundle dropped well under 1 MB.

**Detection going forward:** any future change that causes
`middleware.ts` to import (transitively) from `@/lib/db` will hit this
again. If you change `middleware.ts`, re-run `pnpm --filter @vera/web
build` and watch the "ƒ Proxy (Middleware)" line for size warnings.

**Reference commit:** `1f0bc52 fix(auth): split config so middleware bundle stays under 1 MB Edge limit`

---

## 2. Cron dispatcher hit 401 from `/api/brief/send` on first prod run

**Date:** 2026-05-08

**Symptom:** First successful run of `cron-dispatch-briefs.yml` returned
this body:
```json
{"dispatched": 0, "failed": 2,
 "results": [
   {"scheduleId": 25, "status": "failed", "error": "HTTP 401"},
   {"scheduleId": 26, "status": "failed", "error": "HTTP 401"}
 ]}
```
Two due schedules; both 401. Manual `Send now` from the UI worked fine.

**Diagnosis:** The dispatcher was calling `/api/brief/send` via HTTP:
```ts
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';
await fetch(`${baseUrl}/api/brief/send`, { ... });
```

`process.env.VERCEL_URL` resolves to the **hashed per-deploy URL**
(e.g. `vera-8znwayap6-aditya-uphades-projects.vercel.app`), not the
canonical `vera-mvp.vercel.app`. Hashed deployment URLs are protected
by **Vercel Deployment Protection** by default — they require a Vercel
SSO session. The cron's `curl` had no such session; Vercel returned 401
before the request ever reached the route handler.

**Fix:** Refactor `/api/brief/send/route.ts` to expose a `sendBrief()`
function. The dispatcher imports and calls it **in-process** — no HTTP
hop, no auth, no protection layer. The HTTP POST handler still exists
(used by the "Send now" button), but it's a thin wrapper around
`sendBrief()`.

**Detection going forward:** if any server-side code does `fetch` to
its own API on Vercel using `VERCEL_URL`, it will hit Deployment
Protection. Either (a) call the underlying logic in-process like we do
now, (b) use `process.env.VERCEL_PROJECT_PRODUCTION_URL` (always the
canonical alias), or (c) configure Deployment Protection to bypass the
specific route.

**Reference commit:** `79e67ca fix(cron): call sendBrief in-process to avoid deployment-protection 401s`

---

## 3. Scheduled GitHub Actions workflow not firing automatically

**Date:** 2026-05-08 — ongoing

**Symptom:** `cron-dispatch-briefs.yml` is on `main`, registered as
`active` per `gh api`, manual `workflow_dispatch` runs fire and complete
in ~15 seconds. But the `schedule` trigger fires **zero times** over
~3 hours. Expected ticks at `*/15` boundaries (later changed to
`7,22,37,52`) — none in the run history.

**Diagnosis (best understanding so far):** Two compounding factors,
both documented in GitHub Community discussions:

1. **Onboarding throttle for brand-new accounts.** The repo owner
   account (`adityauphade-mac`) was created 3 days ago. There's
   anecdotal evidence that GitHub defers the first scheduled
   workflow-fire on new free-tier accounts. Not officially documented;
   confirmed by [community discussion #190423](https://github.com/orgs/community/discussions/190423)
   and similar threads from March 2026.

2. **Each commit-to-main resets the scheduler's onboarding window.**
   GitHub staff (SrRyan) in [discussion #185355](https://github.com/orgs/community/discussions/185355):
   > *"Any commit pushed to the default branch will resync the impacted
   > scheduled workflows."*
   The cut both ways: each "resync" commit may also restart the indexing
   timer.

**Workaround attempted (didn't help):**
- Pushed two `main` commits as resync triggers (PR #7, PR #8) — no auto-fire
- Switched cron from `*/15 * * * *` to `7,22,37,52 * * * *` to dodge the
  round-minute traffic jam — no auto-fire

**Current strategy:**
- **Stop pushing to `main`** for at least 6-24 hours
- Watch for the first auto-fire; checkpoints at 15:00 UTC today and
  09:30 UTC tomorrow
- **For the demo:** manually trigger via `gh workflow run cron-dispatch-briefs.yml`
- **If no auto-fire by 24h after the last `main` commit:** migrate to
  Vercel Cron (Pro plan, $20/mo) or Upstash QStash (free tier)

**Detection going forward:**
- `gh api repos/adityauphade-mac/vera-mvp/actions/runs?event=schedule --jq '.total_count'`
  returns 0 → still throttled or not picked up.
- When it starts working, that count climbs by ~96/day (15-min cadence).
- If you see an auto-fire and then it stops, that's a different
  problem — check GitHub status page first.

**Reference commit:** `ee2331a fix(cron): stagger dispatch trigger off the round-minute boundary`

---

## 4. Pushing workflow files needs `workflow` OAuth scope

**Date:** 2026-05-08

**Symptom:** `git push origin <branch>` rejected with:
```
remote: refusing to allow an OAuth App to create or update workflow
`.github/workflows/cron-dispatch-briefs.yml` without `workflow` scope
```

**Diagnosis:** GitHub requires the OAuth token used for git pushes to
have the `workflow` scope when the push touches anything under
`.github/workflows/`. The `gh` CLI's default token only requests
`repo`, not `workflow`.

**Fix:** One of:
1. `gh auth refresh -h github.com -s workflow` (browser device flow)
2. Generate a Personal Access Token with `repo` + `workflow`, use for
   that push only, then revoke
3. Use a different `gh` account that already has the scope

**Detection going forward:** any PR that adds, edits, or deletes a file
under `.github/workflows/` will hit this from any account that hasn't
granted `workflow` scope. The error message is unambiguous.

---

## 5. `next lint` removed in Next.js 16

**Date:** 2026-05-08

**Symptom:**
```
> @vera/web@0.1.0 lint
> next lint
Invalid project directory provided, no such directory: .../apps/web/lint
```

**Diagnosis:** Next.js 16 dropped the bundled `next lint` wrapper. The
existing `"lint": "next lint"` script in `apps/web/package.json` errors
because `next` doesn't recognize the subcommand and treats it as a
positional path arg.

**Fix:** Install ESLint 9 directly + flat config + plugin set
(typescript-eslint, eslint-plugin-react, eslint-plugin-react-hooks,
@next/eslint-plugin-next). Update script: `"lint": "eslint ."`.

Config lives at `apps/web/eslint.config.mjs`. Auth.js workaround files
get a file-scoped `no-explicit-any: off` override since the `any` types
are documented escape hatches for Auth.js v5 monorepo TS inference
issues.

**Detection going forward:** if you upgrade Next.js again and it ships
with a bundled lint wrapper, the manual config still works — just
prefer `eslint .` directly.

**Reference branch:** `chore/wire-eslint`

---

## 6. Vercel preview URL → 401 even though prod is reachable

**Date:** Earlier in the project

**Symptom:** `curl https://vera-<hash>-aditya-uphades-projects.vercel.app/`
returns 401, but `curl https://vera-mvp.vercel.app/` returns 200.

**Diagnosis:** Vercel's **Deployment Protection**. Per-deploy hashed
URLs require a Vercel SSO login by default. The canonical alias
(`vera-mvp.vercel.app`) is publicly reachable.

**This is a feature, not a bug.** It prevents preview deploys from
being indexed or shared accidentally. Don't disable it for the project.
For the cron use case, see entry **#2**.

---

## 7. Local typecheck fails after pulling main: missing PrismaClient

**Date:** Recurring

**Symptom:**
```
lib/db.ts(2,10): error TS2305: Module '"@prisma/client"' has no
exported member 'PrismaClient'.
```

**Diagnosis:** `pnpm install` ignores Prisma's `postinstall` script by
default (security feature in pnpm 10+). `@prisma/client` is empty until
`prisma generate` has run.

**Fix:**
```bash
pnpm --filter @vera/web exec prisma generate
```

The build script already does this (`"build": "prisma generate && next
build"`), but typecheck and dev mode don't. After a fresh
`pnpm install`, run `prisma generate` once.

**Permanent option:** `pnpm approve-builds` and select Prisma packages
to allow them to run install scripts. Then `pnpm install` runs
`prisma generate` automatically.

---

## 8. Dashboard endpoints timed out on every cold request after DB cutover

**Date:** 2026-05-14

**Symptom:** After flipping `USE_DB_DATA_SOURCE=1` on production, every
dashboard endpoint started returning HTTP 500 with wall times of 20–50
seconds. Sign-in worked. The `/api/backfills` endpoint (which doesn't go
through the dashboard data path) returned 401 normally — proving the
function was reachable. Specifically `/api/jobs/aging`, `/api/jobs/write-offs`,
`/api/jobs/follow-ups`, and `/api/reps/outstanding` all timed out.

**First hypothesis (wrong):** Vercel functions couldn't reach the GCP
Cloud SQL instance because of the authorized-networks allowlist.

**Why that was wrong:** a small TCP-probe endpoint deployed at
`/api/debug/db-probe` showed Vercel-to-GCP TCP completes in 32 ms and a
trivial Prisma `SELECT current_user` round-trip completes in 451 ms from
`iad1`. Network was fine.

**Actual diagnosis:** Each cold dashboard request was running the merge-view
query, which selected the full `payload` JSONB column for every row in the
promoted snapshot — ~120,300 rows × ~1.7 KB ≈ 200 MB transferred to the
Vercel function per cold start. On localhost that's instant (loopback,
GB/s). Over the public internet to GCP, Vercel-to-GCP throughput is
roughly 5–15 MB/s, which puts the transfer alone at 15–40 seconds plus
the 11.5 s server-side query plan. Function timed out before the JSONB
could finish streaming.

**Verification:** ran the same merge-view query from a laptop using
`COPY ... TO STDOUT | wc -c`. Confirmed: 205 MB transferred, 65–76 s
total. Server-side `EXPLAIN ANALYZE` showed 11.5 s execution time
dominated by disk I/O reading payload pages into shared buffers.

**Fix:** Push filter + aggregation into Postgres. Two new helpers in
[apps/web/lib/backfill/merge-view.ts](../apps/web/lib/backfill/merge-view.ts):

- `getLiveARJobsWithContext(tenantId)` — applies the AR working-set
  WHERE clause in SQL (mirrors `isInARWorkingSet` from
  `shared/domain/classification.ts`) AND computes the duplicate-address
  count via a CTE joined to each AR job. Returns ~130 rows with the
  full payload plus an `addressCount` column. Total transfer: ~650 KB.
- `getLiveJobsForWriteOffs(tenantId, installDateCutoff)` — analogous
  for the write-offs path: filters to `primary_estimate.id IS NOT NULL
  AND date_completed >= '2024-01-01'`. Returns ~2,200 rows instead of
  120k.

Domain transforms (`toARJob`, `toWriteOffRecord`, heat score, anomalies,
reconciliation) continue to run in TypeScript on the much smaller
filtered set. Zod parsing of the full payload is preserved, so schema-drift
detection isn't lost.

Result: cold-start wire transfer dropped from ~200 MB to ~650 KB (≈ 320×
reduction). Cold-start time dropped from "timeout" to ~1.5 s end-to-end.

**Detection going forward:** if you add a new dashboard endpoint that
pulls from `RawRooflinkJob` / `RawRooflinkLineItems`, do not select
`payload` whole on the full population. Either filter in SQL first (the
right move) or measure the response size before deploying — `COPY (your
query) TO STDOUT | wc -c` from a local psql against `vera_dev` gives
you the bytes. Anything over a few MB per request is a smell.

**Reference commits:**
- `a7a3e4b perf(db-read): push AR filter + address counting into Postgres`
- `083f6a8 Merge: push DB read path filtering into Postgres + safety guard`

---

## 9. Playwright wiped 120k rows of production-shape data from local DB

**Date:** 2026-05-14

**Symptom:** After running `pnpm exec playwright test` against the local
dev server, the dashboards started returning 0 rows everywhere. Initial
panic was that the merge-view changes had broken something. They hadn't —
the DB was just empty.

**Diagnosis:** `tests/e2e/_helpers/global-setup.ts` runs once per
Playwright invocation and executes `DELETE FROM` against eight tables
including `RawRooflinkJob` and `RawRooflinkLineItems`. The intent is to
make spec assertions deterministic (specs that need data seed their own).
The reality: `DATABASE_URL` in `apps/web/.env.development.local` pointed
at `vera_dev`, which had been seeded earlier the same day with 120,300
production-shape Rooflink job payloads (restored from GCP for testing).
Playwright wiped them.

**The data wasn't lost** — the production `vera_prod` DB was untouched
(different host, no test run against it). Recovery took ~90 seconds via
piped `COPY`:

```bash
for table in BackfillRun RawRooflinkJob RawRooflinkLineItems FailureNotificationSetting; do
  psql "$GCP_URL" -c "COPY \"$table\" TO STDOUT" | \
  psql -d vera_dev -c "COPY \"$table\" FROM STDIN"
done
```

**Permanent fix:** added a hard guard at the top of `global-setup.ts`
that probes for any `promoted=true` BackfillRun row before the DELETE
block runs. Tests never create promoted runs, so a non-zero count means
the target DB has real backfill output. The guard throws with a clear
remediation message and aborts the suite without running any DELETE.
Override via `PLAYWRIGHT_ALLOW_PROD_DATA_WIPE=1` for the rare legitimate
case.

The lesson, broader than the fix: **don't run a test suite against a DB
that has irreplaceable data without verifying the test infrastructure's
cleanup behavior first.** The cost of being asked "what does this script
delete?" is 30 seconds; the cost of an unexpected wipe is at minimum
the recovery time plus the trust hit.

**Detection going forward:** the guard is now load-bearing. If you find
yourself wanting to disable it, instead point Playwright at a dedicated
test DB:

```bash
createdb vera_test
DATABASE_URL=postgresql://<user>@localhost:5432/vera_test pnpm exec playwright test
```

The test DB has no promoted runs, so the guard passes; the wipes happen
against a DB that's *meant* to be wiped.

**Reference commit:** `b00242e test(safety): refuse to wipe DB with promoted BackfillRun rows`

---

## How to add an entry

When you debug something that took non-trivial time, write it up here
**before you forget the diagnosis**. Template:

```md
## N. Short, googleable symptom

**Date:** YYYY-MM-DD

**Symptom:** what the developer saw — error message verbatim if possible.

**Diagnosis:** the actual root cause, not the symptom. What was happening
under the hood.

**Fix:** what worked. With code references / commit SHAs.

**Detection going forward:** how to tell if the problem is recurring.

**Reference commit:** `<sha> <message>`
```

The point of this doc is *prevention*, not just record-keeping. If
something in here happens twice, the entry needs to be sharper.
