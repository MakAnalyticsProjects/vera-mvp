# Vera MVP — Improvements backlog

**Date:** May 7, 2026

This is the working backlog from today's review with Israel. One active bug to fix first, then a six-item priority list driving the next phase of work.

Items below are **only** the ones explicitly raised in this conversation. Earlier rounds (already-shipped work, speculative polish, V2 ideas) live elsewhere — see `DISCUSSION.md` §6.8 for the running shipped log.

---

## 1. Active bug — Vera incorrectly claims "no customer names"

**Severity:** medium — produces factually wrong answers in chat. **Effort:** ~15 min including deploy.

**Symptom (from Israel's screenshot):** when asked for customer names, Vera replied:
> "the records I have access to do not include customer names, only addresses"

**That reply is false.** Customer data exists end-to-end:

| Layer | Has customer info? |
|---|---|
| Source `data/jobs_dedup.jsonl` | ✅ All 103,440 records have `customer.name`, `first_name`, `last_name`, `phone`; ~5K with email |
| Preprocess `shared/domain/src/transform.ts` | ✅ Maps `customer.name` → `customerName` on every job |
| `apps/web/data/generated.json` | ✅ First record reads `customerName: "Louis & Marsha Hunke"` |
| `ARJob` Zod schema | ✅ Declares `customerName: z.string().nullable()` |

**Where the bug actually is:** [`apps/web/app/api/chat/route.ts`](apps/web/app/api/chat/route.ts) lines 86–97 — the `listJobs` chat tool returns a hand-picked projection of fields and **omits `customerName`**. The other chat tool (`getJob`, single-id lookup) returns the full job object so customer info IS reachable that way; the hole is specific to `listJobs`.

**Compounding factor:** the system prompt at line 25 says "Each job has: rep, customer, install date, balance, heat score..." — advertising a `customer` field the tool then doesn't return. The model leans on the prompt's promise, fails to find the field in the tool result, and hedges with "I don't have access."

**The fix** (one commit, two-line patch + prompt edit):

```ts
// apps/web/app/api/chat/route.ts, in listJobs.execute:
return jobs.slice(0, limit ?? 10).map((j) => ({
  id: j.id,
  address: j.address,
  customerName: j.customerName,   // ← add
  customerPhone: j.customerPhone, // ← add
  rep: j.rep?.name,
  balance: j.balance,
  daysPastTerms: j.daysPastTerms,
  heatScore: j.heatScore,
  heatBand: j.heatBand,
  anomalies: j.anomalies,
  missingMilestones: j.missingMilestones,
  fellThroughCracks: j.fellThroughCracks,
}));
```

```ts
// And tighten the system prompt line 25:
- Each job has: rep, customer, install date, balance, heat score (0-100), aging bucket, anomalies, missing milestones.
+ Each job has: address, customer name, rep, install date, balance, heat score (0–100), aging bucket, anomalies, missing milestones.
```

**Verification after deploy:** ask the prod chat "what's the customer name on 997 South Lowrance Road?" — expected answer references "Jennifer Lindsey" (the rep) and the actual customer name (Vera should now name them).

---

## 2. Priorities — in order

These are Israel's six priorities for the next phase, in his order. Numbering preserves priority.

### 2.1 Page-by-page mobile responsiveness review

A second-pass review of every page at mobile widths. PR #3 shipped the foundational mobile work (drawer nav, table horizontal scroll, FilterMenu fit-to-viewport, Wave 1–5), and the 375px no-overflow assertion is now part of the regression suite. This item is the **review** to confirm each page on a real device, capture anything the audit screenshots missed, and triage any remaining quirks.

**Pages to walk through:**
- `/` (landing)
- `/docs`, `/design`
- `/dashboard` (today's briefing)
- `/dashboard/aging`
- `/dashboard/follow-ups`
- `/dashboard/milestones`
- `/dashboard/reconciliation`
- `/dashboard/rep-leaderboard`
- `/dashboard/scheduler`
- `Ask Me` modal + `Job detail` sheet + `Draft email` modal

**Approach:** load each on an actual phone (Israel's preferred device), capture anything off, file as a sub-bug under this section. Existing screenshots at `tests/e2e/audit-screens/mobile-*` and `deep-*` give the baseline.

---

### 2.2 Real scheduling backend — GitHub Actions cron (decided, free-tier-friendly)

Today the Scheduler page is **preview-only** — toggling a row, picking a cadence, and changing recipients all save to localStorage but no real recurring sends fire. The "Schedule" button is disabled with a tooltip. **Send-now** does fire a real Resend email immediately; that part is real.

**Why GitHub Actions instead of Vercel cron:** Vercel's free Hobby tier caps cron at **2 jobs / 1× per day**, which can't run a 15-min sweeper. GitHub Actions has no such limits and is **free for our usage** on a private repo (~4 Actions hours/month against a 2,000-minute/month allowance). Israel called this out himself as an option in his original scheduler message.

**Two-layer architecture:**
- **Layer 1 — what the user configures.** User opens Scheduler page, picks "Daily at 8 AM Central." That config saves to the `schedules` table (Neon).
- **Layer 2 — the invisible engine.** A GitHub Actions cron runs every 15 min, hits a Vercel route, which finds schedules whose `next_run_at <= now` and fires them. Users never see or configure this layer.

The 15-min sweeper means at most 15 min drift between the user's "8:00 AM" and the actual send (so "8:00 AM" might fire anywhere from 8:00 to 8:15). For daily AR briefs, invisible.

**Two GH Actions workflows:**

```yaml
# .github/workflows/cron-dispatch-briefs.yml
on:
  schedule:
    - cron: '*/15 * * * *'        # every 15 min
  workflow_dispatch:               # manual trigger for testing
jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST https://vera-mvp.vercel.app/api/cron/dispatch-briefs \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

```yaml
# .github/workflows/cron-generate-briefings.yml
on:
  schedule:
    - cron: '0 12 * * 1-5'        # 7am Central, weekdays
  workflow_dispatch:
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -fsS -X POST https://vera-mvp.vercel.app/api/cron/generate-briefings \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

**What ships in this section:**
- The two workflow YAML files above in `.github/workflows/`
- `apps/web/app/api/cron/dispatch-briefs/route.ts` — auth-gated by `CRON_SECRET` Bearer token, reads pending schedules from Neon, dispatches sends, updates `next_run_at`
- `apps/web/app/api/cron/generate-briefings/route.ts` — same auth, iterates tenants, generates one briefing per tenant (calls into §2.5 logic)
- Cadence-math helper: given `(cadence, day_of_week, day_of_month, time_local, timezone)`, compute next UTC run timestamp
- Scheduler page UI flips: "Schedule" button enables once a recipient is set; saving writes a row to `schedules`; the row shows "Next send: Mon 8:00 AM CT" instead of the preview banner

**Drift / reliability note:** GH Actions cron occasionally skips slots during platform high-load periods. For a 15-min sweeper that's fine — a missed slot just means the next run picks up the pending schedule with at most ~30 min drift.

**Dependencies:** §2.3 (Neon) for schedule persistence.

**Access I need from you:** none — I have repo write access. (Implicit: please don't lock me out of the repo.)

**What I'll set up alone:** generate `CRON_SECRET` (random 32-byte hex), add it as a Vercel env var, add it as a GH repo secret, write both workflow files, write the route validators.

---

### 2.3 Real database — Neon Postgres (decided)

Current state: no DB. Everything reads from `apps/web/data/generated.json` (single tenant). Current tenant is **Priority Roofing Dallas**.

**Choice (decided):** Neon Postgres, provisioned via Vercel's Storage tab → Neon Marketplace integration. That auto-injects `DATABASE_URL` (and a few related env vars) into the project's env, so we don't have to hand-manage credentials.

**First-pass schema:**

```
tenants(id, name, slug, sender_domain, brand_color, created_at)
users(id, tenant_id, email, google_sub, name, image_url,
      role ENUM('owner','member'), created_at)                    -- §2.4
schedules(id, tenant_id, cadence ENUM('daily','weekly','monthly'),
          day_of_week, day_of_month, time_local, timezone,
          recipient, enabled, next_run_at, last_run_at, created_at) -- §2.2
send_log(id, tenant_id, schedule_id, cadence, to_email,
         resend_id, pdf_bytes, status, sent_at)                   -- audit
briefings(id, tenant_id, generated_at, headline, body_md,
          key_jobs JSONB, model, prompt_tokens, completion_tokens) -- §2.5
-- jobs/reps stay in generated.json for now; migrate later
```

**ORM choice (decided):** Prisma. Schema lives in `prisma/schema.prisma`; `prisma generate` produces the typed client; queries written in `apps/web/lib/db.ts` and `shared/db/`.

**What ships in this section:**
- Provision Neon via Vercel Marketplace (one click in dashboard, then env vars auto-flow)
- `shared/db/` package — Drizzle schemas, migrations, Neon client wrapper
- First migration creates the five tables above
- Local dev workflow: `vercel env pull` + `pnpm prisma migrate dev` + `pnpm prisma studio` for schema browsing
- Tenant seed: insert Priority Roofing Dallas as tenant `id=1` so existing flows keep working during the rollout

**Access I need:** **none** — I can provision Neon through Vercel Marketplace since the worktree is already linked to the Vercel project.

**Questions for you (resolved):** Prisma chosen. Neon free tier (0.5 GB, 1 compute hour suspended autoscaling) is fine for now; may need Launch tier ($19/mo) once we have ~3 tenants.

---

### 2.4 Google sign-in via existing GCP (decided)

Today there's no auth. Anyone with the URL can see the dashboard. (`SidebarNav.tsx` has a "Log out" link but it just navigates back to `/`.)

**Approach (decided):** Auth.js (NextAuth) v5 + Google provider, using OAuth credentials from your existing GCP project.

**What ships in this section:**
- `apps/web/app/api/auth/[...nextauth]/route.ts` with Google provider configured against your GCP OAuth client
- `apps/web/middleware.ts` that protects every route under `/dashboard` and `/api/brief/send` (redirects unauthenticated requests to `/login`)
- A `/login` page with a "Sign in with Google" button (matches the warm-CRED palette, uses VeraAvatar)
- Session callback resolves `users.email → users.tenant_id` from the Neon `users` table; session shape: `{ userId, tenantId, email, name, image }`
- New-user provisioning rule: on first sign-in, if the email's domain matches an authorized list (configurable per-tenant later, hardcoded for v1), auto-create a `users` row tied to that tenant. Otherwise, reject with "your email isn't authorized for this workspace."
- Sidebar "Log out" wires to the real `signOut`; the bottom of the sidebar shows the signed-in user's name + avatar
- The dashboard's top bar personalizes "Briefing for [first name], [date]"

**Dependencies:** §2.3 (Neon `users` table).

**Access I need from you:**
1. **Google OAuth client credentials** from your GCP project: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Procedure on your end:
   - GCP Console → APIs & Services → Credentials → Create Credentials → OAuth client ID → "Web application"
   - **Authorized redirect URIs (add both):**
     - `https://vera-mvp.vercel.app/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/google`
   - **Authorized JavaScript origins:**
     - `https://vera-mvp.vercel.app`
     - `http://localhost:3000`
   - Drop the Client ID + Client Secret to me however you prefer (1Password share, or paste here)

**Whitelist policy (decided for v1):** **open** — any signed-in Google account is admitted on first sign-in and auto-bound to the Priority Roofing Dallas tenant. No allow-list filter. (See note below for what this opens up and how to tighten later.)

**What I'll set up alone:** `NEXTAUTH_SECRET` (random 32-byte hex string, generated and added as an env var on Vercel + locally), the entire Auth.js wiring, the login page, the middleware, and the user-tenant resolver.

> **Important security note on "anyone allowed":** until a whitelist is added, anyone who finds the URL `https://vera-mvp.vercel.app` and has any Google account can sign in and see Priority Roofing Dallas's AR data — outstanding balances, customer names, rep names, draft email content. For demo and small-circle use this is fine. The moment the URL leaks beyond the people you trust, you lose that boundary. Two ways to harden later (~30 min of work each): (a) restrict to `@makanalytics.org` domain, (b) explicit email allow-list editable from a `/dashboard/settings/team` page. Recommend we add at least (a) before showing prod to a wider audience.

---

### 2.5 AI-generated "Today's briefing" (decided)

Israel's framing: when someone logs in, the briefing should feel less like a static counter row and more like a fresh story from the data — specific reps by name, what changed overnight, what to act on first.

**Current state:** [`apps/web/app/dashboard/page.tsx`](apps/web/app/dashboard/page.tsx) computes a hand-rolled briefing in `composeBriefing` based on critical / hot / fell-through counts. Generic — same shape day to day.

**Approach (decided):** an LLM-generated block that runs once a night per tenant, writes the result to a `briefings` row, dashboard reads it.

**What ships in this section:**
- `briefings` table (already in §2.3 schema)
- Triggered by the `cron-generate-briefings.yml` GH Actions workflow (see §2.2) at 7am Central weekdays. The route handler iterates tenants and generates one briefing per tenant.
- `apps/web/lib/briefing-generator.ts` — assembles a context payload (today's stats + diff vs yesterday's snapshot + the top 5 critical jobs with rep + customer names + any anomalies that flipped overnight), calls the LLM, parses headline + body markdown, writes to DB.
- Dashboard `composeBriefing` becomes a fallback. The page reads the latest `briefings` row for the tenant first; if it's >24 h old or missing, falls back to the static composer so the page never breaks.
- A "regenerate" button in the briefing card (admin-only, rate-limited) — useful during the demo and for fresh perspectives during the day.

**Dependencies:** §2.3 (Neon for `briefings`), §2.2 (cron infra).

**Access I need:** none — `OPENAI_API_KEY` is already in Vercel prod and used by `/api/chat`. Same key works.

**Decisions:**
- **Model:** **gpt-4o** for the briefing generator. Chat stays on `gpt-4o-mini`.
- **Time of day:** **7am Central, weekdays.** Per-tenant override stored on `tenants.briefing_time_local` and `tenants.briefing_timezone` columns; user can change it from a settings page (added in §2.4 / settings polish).
- **Industry news:** **in v1.** Plan in §2.5b below.

### 2.5b Industry-news context inside the briefing (v1)

**Sources (start here, swap later):**
1. **NWS (National Weather Service)** API — free, government-run, very reliable. Pulls active alerts for the tenant's state (severe thunderstorm warnings, hail watches, hurricane updates). Most relevant signal for a roofer — storms drive lead volume.
2. **NewsAPI.org** — keyword search like `"Texas roofing" OR "insurance carrier roofing claims"`. Free tier allows ~100 requests/day, plenty for once-nightly use.

**Integration:** at briefing generation time, we fetch the latest 3 storm alerts (NWS, scoped to the tenant's state) and 3 industry headlines (NewsAPI), pass them to `gpt-4o` alongside the AR data, and ask the model to weave any relevant connections into the briefing. Example output:

> *"NWS issued a severe-thunderstorm warning for Dallas County last night — could feed lead volume this week, just as you're sitting on $254K in 60+ past terms. Worth thinking about whether to ramp follow-ups before new claims pile up."*

**Reliability:** if either feed times out or returns nothing, the briefing generates without it. Hard fallback to AR-only briefing. No briefing generation is allowed to fail because a third-party API hiccupped.

**Effort:** adds ~2 h to §2.5. New env var: `NEWSAPI_KEY` (I'll request a key from newsapi.org — free tier, no purchase).

**Open question:** any specific industry source you trust more (RoofingContractor.com, Texas-specific outlets)? If not, we start with NWS + NewsAPI and revisit later.

---

### 2.6 More animations on app + dashboard (decided)

What's already in the app:

| Animation | Where |
|---|---|
| `vera-rise` / `vera-rise-delay-1..3` | Section entrance on dashboard pages |
| `vera-modal-in` | Centered Ask Me modal |
| `vera-backdrop-in` | Modal backdrop fade |
| `vera-callout-in` | Hover callouts |
| `vera-sheet-in` | Job detail drawer |
| `vera-fab-pulse` | Continuous pulse on the Ask Me FAB |
| `vera-drawer-in` | Mobile nav drawer slide-in (PR #3) |

All respect `prefers-reduced-motion`. Tokens live in `apps/web/app/globals.css`.

**Candidate list — pick which to include in v1:**
1. **Tap-feedback / press states** on every clickable row (subtle scale + opacity). Most visible mobile-only win.
2. **Number tickers** on MetricTile values that change between visits (count-up animation).
3. **Heat-meter glow** on jobs in the critical band (subtle pulse on the meter bar).
4. **Page transitions** between dashboard routes (fade-through using the App Router transition API).
5. **"Sent ✓" success state** on the scheduler — green flash + checkmark draw.
6. **AgingChip / HeatMeter color-shift transitions** when filter or sort changes the visible set (fade rather than hard cut).
7. **Skeleton loaders** for dashboard sections during initial mount.
8. **VeraAvatar idle micro-animations** — slow blink + occasional head turn.

**Access I need:** none — pure frontend.

**Decided:** **all 8 in v1**. Estimate ~6 hours. Ship order (most-visible first):

1. Tap-feedback / press states (mobile-only win)
2. Number tickers on MetricTile
3. Skeleton loaders during initial mount
4. "Sent ✓" success state on the scheduler
5. AgingChip / HeatMeter color-shift transitions on filter change
6. VeraAvatar idle micro-animations
7. Heat-meter critical-band glow
8. Page transitions between dashboard routes (last — most fiddly)

---

## 3. Operations — what I need from you vs. what I'll do alone

### 3.1 What I need from you to start

| # | Item | Why | Section it unblocks |
|---|---|---|---|
| 1 | **Google OAuth client credentials** from your existing GCP project — `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`, plus the four redirect URIs / origins listed in §2.4 added to the OAuth client | Auth.js needs them. *You said you'd send these later — no rush.* | §2.4 |
| 2 | (~~Vercel Pro plan~~ — **resolved**: pivoted to GH Actions cron, free tier is enough) | — | §2.2 |
| 3 | (~~Authorized email/domain whitelist~~ — **resolved**: open allow-anyone for v1) | — | §2.4 |
| 4 | (~~Industry news source preference~~ — **resolved**: NWS + NewsAPI defaults accepted) | — | §2.5b |
| 5 | (~~Decisions on Q1–Q7~~ — **all resolved** below) | — | various |

### 3.2 What I can set up alone — no extra credentials needed

| # | Item | Section |
|---|---|---|
| 1 | The customer-name chat bug fix (deploy + verify on prod) | §1 |
| 2 | Provision Neon Postgres via Vercel Marketplace (one-click, auto-injects `DATABASE_URL`) | §2.3 |
| 3 | Prisma setup + first migration (`tenants`, `users`, `schedules`, `send_log`, `briefings`) + Priority Roofing Dallas seed | §2.3 |
| 4 | Two GH Actions workflow files in `.github/workflows/` + `/api/cron/dispatch-briefs` and `/api/cron/generate-briefings` routes + `CRON_SECRET` provisioning + cadence-math + Scheduler UI flip from preview to real | §2.2 |
| 5 | `NEXTAUTH_SECRET` generation and Vercel/local env wiring | §2.4 |
| 6 | Auth.js install + `[...nextauth]/route.ts` + middleware + `/login` page + user-tenant resolver (waits only for Google credentials in §3.1#2) | §2.4 |
| 7 | AI briefing generator — context assembly, LLM call, DB writes, dashboard read path with static fallback, regenerate button | §2.5 |
| 8 | All animation work in §2.6 | §2.6 |
| 9 | Re-run mobile audit specs at 375 / 414 / 768 to give a fresh baseline for §2.1 | §2.1 |

### 3.3 Resolved decisions

| # | Question | Decision |
|---|---|---|
| Q1 | ORM | **Prisma** |
| Q2 | Vercel cron sweeper frequency | **15 min** |
| Q3 | Auth whitelist for v1 | **Open — any signed-in Google account is admitted** (with security caveat — see §2.4) |
| Q4 | Briefing LLM model | **gpt-4o** |
| Q5 | Briefing run time | **7am Central, weekdays**, per-tenant configurable in settings |
| Q6 | Industry news in v1 briefing | **Yes** — NWS storm alerts + NewsAPI roofing headlines (see §2.5b) |
| Q7 | Which animations | **All 8** in v1 (~6 h) |

### 3.4 Outstanding items still needed from you

| # | Item | Section it unblocks |
|---|---|---|
| 1 | Google OAuth credentials (Client ID + Secret) from GCP, with the four redirect URIs / origins listed in §2.4 added to the OAuth client. *You said you'll send these later — no rush, just blocks §2.4 when we get there.* | §2.4 |

---

## 4. Suggested execution order

1. **§1 — customer-name chat bug fix** (~15 min, no dependencies, lands first)
2. **§2.3 — Neon + Drizzle + first migration** (~3 h, unblocks §2.2 / §2.4 / §2.5)
3. **§2.4 — Google sign-in** (~3 h, can run in parallel with §2.2 once §2.3 is in)
4. **§2.2 — Vercel cron + scheduler dispatch** (~3 h, parallel with §2.4)
5. **§2.5 — AI briefing generator** (~3 h, depends on §2.3 + §2.2)
6. **§2.1 — mobile review pass** (your action, runs anytime)
7. **§2.6 — animations** (~3–6 h depending on Q7, slots in last)

Roughly **2–3 working days** end to end, gated mostly on §3.1 credentials and §3.3 answers.
