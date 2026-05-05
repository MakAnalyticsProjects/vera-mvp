# Vera MVP — Architecture & Tech Stack

## Architecture summary

- **Monorepo** managed by **pnpm workspaces** + **Turborepo** (for caching and parallel scripts).
- **One Next.js 16 app** (`apps/web`) — handles both UI and backend via API routes deployed as Vercel Functions. The "backend" is real backend code; it just lives inside the same Next.js app and deploys serverlessly.
- **All shared code lives in `shared/`** — types, schemas, UI components, domain logic, utilities.
- **No database in MVP.** Data is precomputed at build time into a slim JSON file. A DB slot is preserved in the architecture so we can add Postgres (Neon via Vercel Marketplace) when persistence is needed (write-offs, audit trail, user adjustments).
- **Deployed to Vercel.**
- **End-to-end tests for every module via Playwright.**

---

## Repository layout

```
israil_mvp/
├── apps/
│   └── web/                    # Next.js 16 app (UI + API routes)
│       ├── app/
│       │   ├── (marketing)/
│       │   │   └── page.tsx    # / — landing page
│       │   ├── dashboard/
│       │   │   ├── page.tsx               # /dashboard — today's briefing
│       │   │   ├── aging/page.tsx         # /dashboard/aging
│       │   │   ├── milestones/page.tsx    # /dashboard/milestones
│       │   │   ├── follow-ups/page.tsx    # /dashboard/follow-ups
│       │   │   ├── rep-report/page.tsx    # /dashboard/rep-report
│       │   │   └── reconciliation/page.tsx# /dashboard/reconciliation
│       │   ├── api/
│       │   │   ├── chat/route.ts                       # POST /api/chat
│       │   │   ├── jobs/aging/route.ts                 # GET — aging + anomaly report
│       │   │   ├── jobs/milestones/route.ts            # GET — milestone gaps
│       │   │   ├── jobs/follow-ups/route.ts            # GET — heat-scored queue
│       │   │   ├── jobs/reconciliation/route.ts        # GET — "fell through cracks"
│       │   │   └── reps/outstanding/route.ts           # GET — weekly leaderboard
│       │   └── layout.tsx
│       ├── public/
│       └── package.json
│
├── shared/
│   ├── types/                  # TypeScript types + Zod schemas
│   │   ├── job.ts
│   │   ├── rep.ts
│   │   └── index.ts
│   ├── ui/                     # shadcn components + design tokens
│   │   ├── components/         # Button, Card, Table, Sheet, etc.
│   │   ├── theme/              # color tokens, typography, spacing
│   │   └── package.json
│   ├── domain/                 # Pure business logic — no React, no I/O
│   │   ├── heat-score.ts
│   │   ├── anomalies.ts
│   │   ├── aging.ts
│   │   ├── reconciliation.ts
│   │   └── package.json
│   └── utils/                  # date math, formatting, classification
│       └── package.json
│
├── scripts/
│   └── preprocess.ts           # Build-time: jobs_dedup.jsonl → data.json
│
├── tests/
│   └── e2e/                    # Playwright specs (one per module)
│       ├── landing.spec.ts
│       ├── dashboard-overview.spec.ts
│       ├── aging.spec.ts
│       ├── milestones.spec.ts
│       ├── follow-ups.spec.ts
│       ├── rep-report.spec.ts
│       ├── reconciliation.spec.ts
│       └── chat.spec.ts
│
├── data/                       # gitignored — input + generated artifacts
│   ├── jobs_dedup.jsonl        # source export (raw)
│   └── generated.json          # output of preprocess (slim, ~150 KB)
│
├── pnpm-workspace.yaml
├── turbo.json
├── playwright.config.ts
├── CLAUDE.md                   # constitution
├── SPEC.md
├── DISCUSSION.md
├── ARCHITECTURE.md
└── package.json                # workspace root
```

---

## Tech stack — item by item

### Application

| Item | Purpose | Why |
|---|---|---|
| **Next.js 16** (App Router) | Full-stack framework | UI + API routes in one app; native Vercel deploy; Server Components for static rendering. |
| **TypeScript** (strict) | Language | The data shape is gnarly. Strict mode mandatory. |
| **Tailwind CSS** | Styling | Utility-first; pairs natively with shadcn/ui. |
| **shadcn/ui** | UI components | Copy-in registry — Card, Table, Dialog, Sheet, Tabs, Tooltip, etc. Lives in `shared/ui`. |
| **Lucide Icons** | Iconography | Default with shadcn. |
| **TanStack Table v8** | Data tables | Sort, filter, group, expand on the aging table and rep leaderboard. |
| **Recharts** (via Tremor) | Charts | Aging buckets, heat distribution, rep $ leaderboard bars. |
| **React Hook Form** | Form state | All forms (filter panels, date range pickers, write-off marks). Zero re-renders. |
| **Zod** | Schemas + validation | Single source of truth for types and runtime validation (data.json shape, form inputs, API request/response). Used in shared/types. |
| **nuqs** | URL search params | Filter state in the URL — refreshable, shareable, browser back works. |
| **date-fns** | Date math | Days since install, days past terms, "edited within 14 days." |
| **next-themes** | Dark mode toggle | Optional but expected on a dashboard. |

### AI

| Item | Purpose | Why |
|---|---|---|
| **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) | Chat plumbing | `useChat` hook, streaming, tool use. |
| **Claude Sonnet 4.6** | LLM | Powers Vera's chat and email-draft generation. |

### Build, lint, test

| Item | Purpose | Why |
|---|---|---|
| **pnpm** | Package manager | Fastest, workspace-native. |
| **Turborepo** | Task runner / cache | `turbo dev`, `turbo build`, `turbo test` across the monorepo. |
| **Playwright** | E2E testing | One spec per module; run on every PR; runs against the built app. |
| **ESLint + Prettier** | Lint + format | Standard. |
| **Husky + lint-staged** | Pre-commit hooks | Format + lint before commit. |

### Deployment

| Item | Purpose |
|---|---|
| **Vercel** | Hosting + CI/CD. Build runs the preprocess script + Next.js build. API routes deploy as Vercel Functions. |

### Deferred (not in MVP, slot reserved)

| Item | When we'd add it |
|---|---|
| **Vercel Postgres** (Neon) | When we need persistence — write-off marks, audit trail, user-saved filters. |
| **Drizzle ORM** | Once Postgres is added. |
| **Resend** | When draft emails graduate to autosend. |
| **Clerk** | When per-rep logins are needed (v2). |

---

## Data flow

```
┌─────────────────────────────────────────────────────────────┐
│ BUILD TIME                                                   │
│                                                              │
│  data/jobs_dedup.jsonl  ──[scripts/preprocess.ts]──►          │
│                          data/generated.json                 │
│                                                              │
│  - Streams JSONL line by line                                │
│  - Filters to AR working set (~130 records)                  │
│  - Computes heat score, anomalies, aging, reconciliation     │
│  - Writes ~150 KB JSON                                       │
│                                                              │
│  Domain logic lives in shared/domain/ — same code is used    │
│  here AND server-side, so behavior never diverges.           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RUNTIME — Browser                                            │
│                                                              │
│  Each dashboard route fetches its own endpoint:              │
│    /dashboard/aging          ─► GET /api/jobs/aging          │
│    /dashboard/milestones     ─► GET /api/jobs/milestones     │
│    /dashboard/follow-ups     ─► GET /api/jobs/follow-ups     │
│    /dashboard/reconciliation ─► GET /api/jobs/reconciliation │
│    /dashboard/rep-report     ─► GET /api/reps/outstanding    │
│                                                              │
│  Filters/sort live in URL via nuqs and re-call the endpoint. │
│  Chat ─► POST /api/chat (streamed).                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ RUNTIME — Server (Vercel Functions)                          │
│                                                              │
│  Each /api/* route:                                          │
│    1. Validates request (query params or body) with Zod     │
│    2. Reads generated.json from in-memory cache              │
│    3. Calls into shared/domain to filter / aggregate         │
│    4. Returns Zod-validated JSON (or streams, for /api/chat) │
│                                                              │
│  No route reads the raw 188 MB JSONL. No DB calls.           │
│  All routes import shared/types and shared/domain.           │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend question — decision

**Yes, there is a backend.** It lives inside the Next.js app as API routes (`/api/*`) deployed as Vercel Functions. This gives us:

- Server-side validation with Zod
- Secrets (Anthropic API key) never leak to the browser
- Future expansion path — adding `/api/jobs/[id]/write-off` or similar is trivial
- Single deploy unit (no separate service to manage)

If we later need a long-running server (cron jobs, websockets), we can add a separate `apps/api` package without touching the web app. For MVP, serverless is sufficient.

---

## Database question — decision

**No database in MVP. Slot reserved for Postgres later.**

Reasoning:
- The data is static (~130 AR jobs). Zero benefit from a query layer at this size.
- Heat scores, anomalies, aging are computed once at build time.
- Adding Postgres later is a half-day change: provision Neon via Vercel Marketplace, add Drizzle, migrate domain functions to read from DB.

If you decide we need persistence (write-off marks survive deploys, audit trail of follow-ups sent, etc.), say the word and we add it before scaffold. Otherwise we ship without.

---

## Design theme

A warm fintech aesthetic — premium but not cold, intelligent but not overwhelming. Inspired by CRED's editorial composure, reinterpreted softer and more personal. The product should feel like a thoughtful companion, not a high-performance dashboard.

**The aesthetic deliberately rejects:** pure black on pure white, loud accent colors, dense data grids, massive stat numbers, sharp 90° corners everywhere, cool gray surfaces.

### Color palette (light mode primary)

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#F5EFE6` | Page background — warm parchment |
| `bg-card` | `#FFFCF7` | Card surfaces — soft cream |
| `bg-elevated` | `#FFFFFF` | Popovers, modals (rare) |
| `text-primary` | `#1F1B16` | Body text — deep warm brown |
| `text-secondary` | `#6E6258` | Labels, captions — warm gray |
| `text-muted` | `#9C8E80` | Helper text — warm taupe |
| `border` | `#E8DECF` | Hairlines — soft tan |
| `accent` | `#C8854E` | Primary CTAs, Vera's voice — terracotta brass |
| `accent-soft` | `#E8C5A0` | Highlights, soft fills |
| `success` | `#7A8F6F` | Positive signals — sage moss |

### Heat score bands

| Band | Hex | Feel |
|---|---|---|
| Cool (0–25) | `#7A8F6F` | Sage — calm |
| Warm (26–50) | `#C9A05F` | Mellow mustard — keep an eye |
| Hot (51–75) | `#C8714C` | Warm terracotta — needs attention |
| Critical (76–100) | `#A14535` | Muted brick — has presence without screaming |

### Aging bucket colors

| Bucket | Hex |
|---|---|
| Within terms | `#9C8E80` (muted, no urgency) |
| 1–30 past terms | `#C9A05F` (mellow mustard) |
| 31–60 past terms | `#C8714C` (warm terracotta) |
| 60+ past terms | `#A14535` (muted brick) |

### Typography

| Use | Font |
|---|---|
| Display / headings | **Fraunces** (variable serif, optical sizing — soft at large, crisp at small) |
| Body / UI | **Inter** (variable sans) |
| Numerics in tables | Inter with `font-variant-numeric: tabular-nums` |

### Density and rhythm

- **Page max-width:** 1200px, centered. Never edge-to-edge.
- **Section vertical rhythm:** 64px between major sections.
- **Card padding:** 32px desktop, 24px mobile.
- **Table row height:** **56px** — fewer rows visible, reads as a list, not a grid.
- **Border radii:** 16–20px on cards, 12px on inputs, full on pills/badges.
- **Shadows:** subtle, warm-tinted (brown undertones, never cool gray).

### Component patterns

- **Heat score badge:** colored pill with score number; tooltip shows the component breakdown
- **Aging row:** rep avatar · address · balance · days past terms · bucket chip · heat badge · missing-step tags — generous spacing between
- **Anomaly tag:** small chip with icon + 1-line label
- **Vera's voice:** italic + accent color when she narrates

### Voice and tone

Vera speaks like a thoughtful colleague, not an assistant. Numbers come with context, not dumped. Critical signals get presence without alarm.

> "Good morning. I'm watching three jobs more closely than usual today — Mike Ahrend's McMackin install crossed into the Hot band overnight."

Not:

> "🚨 3 CRITICAL ALERTS — IMMEDIATE ACTION REQUIRED"

This shapes button copy, empty states, error messages, email drafts, and chat tone equally.

---

## Testing — Playwright E2E

One spec file per module. Each spec covers the **happy path + key interactions** for that module.

| Spec | What it tests |
|---|---|
| `landing.spec.ts` | Landing page renders, CTA navigates to /dashboard |
| `dashboard-overview.spec.ts` | KPI tiles render with data, links to all 5 reports work |
| `aging.spec.ts` | Aging buckets show counts, sort/filter/group work, anomaly chips render with tooltip |
| `milestones.spec.ts` | Milestone gaps surface, missing-step tags display |
| `follow-ups.spec.ts` | Heat scores render, Critical jobs route to Executive Queue, email draft modal opens, copy-to-clipboard works |
| `rep-report.spec.ts` | Leaderboard sorts, region/job-type filters apply, "Generate weekly digest" produces a draft |
| `reconciliation.spec.ts` | "Fell through cracks" list renders, signal logic is reflected in row reasons |
| `chat.spec.ts` | Chat panel opens, sends a message, streams a response (mocked AI in CI), deflects off-topic |

Tests run against `next start` (production build) in CI, headless Chromium.
Playwright config:
- Auto-start dev server in `webServer`
- Reuses test data fixture (deterministic snapshot of `generated.json`)
- AI calls mocked in CI; live in local with a flag

### Test commands

```
pnpm test:e2e              # full suite
pnpm test:e2e:ui           # Playwright UI mode
pnpm test:e2e -- aging     # single spec
```

### Coverage policy

- Every new module gets a spec before it's considered done.
- A PR that adds a route without a spec is rejected by the CLAUDE.md rules.
- Unit tests are encouraged for `shared/domain/*` (pure functions, easy to test) but not strictly required for MVP — Playwright is the gate.

---

## Development workflow

```
pnpm install              # install all workspaces
pnpm preprocess           # generate data/generated.json
pnpm dev                  # Turbo runs apps/web on :3000
pnpm test:e2e             # Playwright suite
pnpm build                # production build (also runs preprocess)
pnpm typecheck            # TS across all workspaces
pnpm lint                 # ESLint across all workspaces
```

---

## Estimated bundle size

| | Size |
|---|---|
| HTML / CSS / JS bundle | ~180 KB (gzipped) |
| Slim data JSON | ~150 KB (gzipped) |
| Total first-load | ~330 KB |
| Subsequent navigations | instant (data cached) |
