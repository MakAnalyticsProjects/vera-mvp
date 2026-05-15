# Vera Calloway — AR MVP

An AI Accounts Receivable specialist for a roofing contractor (Priority Roofs).
Vera pulls live job + line-item data from Rooflink, scores each open invoice
on a heat scale, surfaces the ones that need attention, and drafts the
follow-up emails before the rep has to ask.

**Live:** <https://vera-mvp.vercel.app>
**Status:** in production, DB-backed, ~130 active AR jobs against ~120k Rooflink records.

---

## The 30-second mental model

```
┌──────────────────┐  scheduled / manual  ┌──────────────────────┐
│ Rooflink REST    │ ───  backfill   ───► │ Postgres (GCP)       │
│ API              │                      │ vera_prod            │
└──────────────────┘                      │  ├─ RawRooflinkJob   │
                                          │  └─ RawRooflinkLineItems
                                          └─────────┬────────────┘
                                                    │ filter + aggregate
                                                    │ in SQL, pushdown
                                                    ▼
                                          ┌──────────────────────┐
                                          │ Next.js 16 on Vercel │
                                          │ ├─ /api/jobs/*       │
                                          │ ├─ /api/reps/*       │
                                          │ └─ /dashboard/*      │
                                          └──────────────────────┘
```

The dashboard reads from Postgres at request time. Every promoted backfill
makes new data visible automatically — no rebuild, no deploy.

---

## Quickstart for new developers

```bash
# 1. Clone + install
git clone git@github.com:adityauphade-mac/vera-mvp.git
cd vera-mvp
pnpm install

# 2. Copy .env.local from a teammate (or follow docs/ONBOARDING.md)
cp apps/web/.env.example apps/web/.env.local
# Edit: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, ANTHROPIC_API_KEY,
# DATABASE_URL (local postgres), RESEND_API_KEY

# 3. Apply DB schema
pnpm --filter @vera/web prisma migrate deploy

# 4. Optional: seed real data — see docs/ONBOARDING.md "Seeding local"

# 5. Start dev server
pnpm dev   # http://localhost:3000
```

Full step-by-step including Google OAuth setup: [`docs/ONBOARDING.md`](docs/ONBOARDING.md).

---

## Where to look next

| If you're trying to… | Start here |
|---|---|
| Get a working local environment | [`docs/ONBOARDING.md`](docs/ONBOARDING.md) |
| Understand the system at a glance | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Understand what's stored in the DB | [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) |
| See where things run (Vercel, GCP, Resend) | [`docs/INFRASTRUCTURE.md`](docs/INFRASTRUCTURE.md) |
| Reference a specific API route | [`docs/API.md`](docs/API.md) |
| Do an operational task (deploy, backfill, rotate creds) | [`docs/OPERATIONS.md`](docs/OPERATIONS.md) |
| See what's shipped and what's deferred | [`docs/BACKLOG.md`](docs/BACKLOG.md) + [`docs/RELEASE.md`](docs/RELEASE.md) |
| Read the engineering rules ("the constitution") | [`CLAUDE.md`](CLAUDE.md) |
| Understand the product brief and decisions | [`SPEC.md`](SPEC.md) + [`DISCUSSION.md`](DISCUSSION.md) |
| Run a demo | [`docs/DEMO.md`](docs/DEMO.md) |

---

## The dashboard surfaces

| Route | What it shows |
|---|---|
| `/` | Landing — assumptions surfaced for executive review |
| `/dashboard` | Today's AI-generated briefing + 5 key metric tiles |
| `/dashboard/aging` | Terms-relative aging buckets, anomaly badges, heat scores |
| `/dashboard/milestones` | Per-job missing-step tags |
| `/dashboard/follow-ups` | Heat-scored queue with drafted follow-up emails per row |
| `/dashboard/reconciliation` | Weekly "fell through cracks" sweep |
| `/dashboard/rep-leaderboard` | Reps ranked by outstanding AR + heat |
| `/dashboard/write-offs` | Estimates with Amount Withheld discounts (Active AR + Paid off) |
| `/dashboard/scheduler` | Recurring brief schedules + Run-now backfills |
| `/dashboard/audit-logs` | Every meaningful action, who did it, before/after |
| `/design` | Internal design-system inventory |

---

## What's deliberately out of scope (MVP)

QuickBooks sync, per-rep authentication, multi-tenant workspaces, mobile-first
layouts, trend analysis, end-of-month close, departed-rep audits, editing data
back to Rooflink. Each is tracked in [`docs/BACKLOG.md`](docs/BACKLOG.md) with
the reasoning for deferral.

---

## Tech stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS · shadcn/ui · Prisma + Postgres (GCP Cloud SQL) · Auth.js v5 (Google OAuth) · Vercel AI SDK + Anthropic Claude · Resend (transactional email + scheduled sends) · `@react-pdf/renderer` (in-process PDF) · Upstash QStash (backfill ticks) · Playwright (E2E only) · pnpm workspaces + Turborepo.

Full stack rationale and pins in [`CLAUDE.md`](CLAUDE.md).
