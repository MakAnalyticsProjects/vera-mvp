# Vera MVP — Execution Plan

Eight phases, ~10–20 minutes each, total ~100–120 minutes from empty repo to demo-ready production URL. Every phase follows the same tight loop:

> **implement → test → ship**

GitHub repo is connected to Vercel from Phase 1, so every `git push` triggers an automatic deploy. We never accumulate untested chunks — every ~15 minutes there's a new live URL to verify.

---

## Phase overview

| # | Phase | What ships at the end | ~Time |
|---|---|---|---|
| 1 | Foundation + Vercel link | Blank Next.js page on a live URL | 10–15 min |
| 2 | Data + Domain | Generated JSON + tested domain rules | 15–20 min |
| 3 | API + Theme | All 6 endpoints live, design system page renders | 15 min |
| 4 | Landing + Dashboard shell | Landing + nav + Today's Briefing | 10–15 min |
| 5 | Reports A (reconciliation + milestones) | Two simplest reports live | 10 min |
| 6 | Reports B (aging + rep report + follow-ups) | Three richer reports live | 20 min |
| 7 | Chat | Vera chat alive on production | 10 min |
| 8 | Polish + Final deploy | Full Playwright green, demo-ready URL | 10–15 min |

---

## Phase format (every phase has these four blocks)

- **Items** — what gets created or changed
- **Phase goal** — one line, what's true at the end
- **Test** — how we verify the phase
- **Ship** — exact git/CI flow that publishes it

---

## Phase 1 — Foundation + Vercel

**Items.**
- `pnpm-workspace.yaml`, `turbo.json`
- `apps/web` — Next.js 16, TS strict, Tailwind, App Router
- `shared/types`, `shared/ui`, `shared/domain`, `shared/utils` — empty packages
- ESLint + Prettier + Husky + lint-staged
- Playwright installed; one smoke spec at `tests/e2e/landing.spec.ts` (just "page loads")
- `.env.example` with `ANTHROPIC_API_KEY=`
- GitHub repo created and pushed
- Vercel project linked; `ANTHROPIC_API_KEY` set in Vercel env

**Phase goal.** A blank Next.js placeholder page is live at a Vercel URL.

**Test.**
- Local: `pnpm dev` → `:3000` shows placeholder; `pnpm typecheck && pnpm lint` clean.
- E2E: `pnpm test:e2e` → smoke spec passes (page loads, title correct).
- Production: visit the Vercel URL → same placeholder loads.

**Ship.**
```
git add -A
git commit -m "phase 1: foundation + vercel"
git push origin main
# → Vercel auto-deploys
# → Confirm production URL renders
```

---

## Phase 2 — Data + Domain

**Items.**
- `shared/types/src/job.ts` — Zod schemas for source RoofLink shape and slim Vera shape
- `scripts/preprocess.ts` — stream-reads JSONL, filters to AR working set, computes derived fields, writes `data/generated.json`
- `shared/domain/classification.ts`, `aging.ts`, `anomalies.ts`, `heat-score.ts`, `reconciliation.ts`, `follow-ups.ts`
- `tests/fixtures/generated.fixture.json` (deterministic snapshot)
- `pnpm preprocess` script wired into `prebuild` so Vercel runs it on every deploy
- Vitest tests on the trickiest domain rules (heat score math, fell-through-cracks logic)

**Phase goal.** Slim JSON exists; every domain rule is implemented, tested, and matches expected counts on the fixture.

**Test.**
- `pnpm preprocess` → produces `data/generated.json` (~150 KB) in under 30 seconds.
- `pnpm test` (Vitest) → domain function tests pass.
- `pnpm test:e2e` → smoke still green.

**Ship.**
```
git add -A
git commit -m "phase 2: data + domain"
git push
# → Vercel rebuilds (prebuild runs preprocess)
# → Confirm build logs show preprocess succeeded
```

---

## Phase 3 — API + Theme

**Items.**
- `apps/web/lib/data.ts` — singleton in-memory cache of `generated.json`
- 6 API routes:
  - `GET /api/jobs/aging` (filters: `bucket`, `rep`, `region`, `jobType`)
  - `GET /api/jobs/milestones` (filters: `rep`)
  - `GET /api/jobs/follow-ups` (filters: `band`, `rep`)
  - `GET /api/jobs/reconciliation`
  - `GET /api/reps/outstanding` (filters: `sort`, `region`, `jobType`)
  - `POST /api/chat` (Vercel AI SDK + `@ai-sdk/anthropic`, streaming, system prompt)
- All routes Zod-validated in and out
- Tailwind config with warm palette as CSS variables
- Fraunces + Inter via `next/font`
- shadcn components installed + themed: Button, Card, Sheet, Tabs, Dialog, Tooltip, Badge, Input, Select, Form, Table, ScrollArea, Avatar
- Custom Vera components: `HeatScoreBadge`, `AgingChip`, `AnomalyTag`, `MissingStepTag`, `VeraQuote`, `MetricTile`
- Internal preview at `/dashboard/_design`

**Phase goal.** Every API endpoint responds with real data; every Vera component renders in the warm theme.

**Test.**
- `curl https://<vercel-url>/api/jobs/aging` → returns expected shape.
- Visit `/dashboard/_design` → all components render, no console errors.
- E2E: `tests/e2e/api.spec.ts` (new) hits each endpoint and validates response schema; `tests/e2e/design-system.spec.ts` (new) checks key components render.

**Ship.**
```
git add -A
git commit -m "phase 3: api + theme"
git push
```

---

## Phase 4 — Landing + Dashboard Shell

**Items.**
- `app/(marketing)/page.tsx` — hero, "What I do" (5 cards), "How I think" (key assumptions), "What's not in this MVP", CTA → `/dashboard`
- `app/dashboard/layout.tsx` — sidebar nav (5 reports), top bar with date and "Generate weekly digest" button, dockable chat panel placeholder (right rail)
- `app/dashboard/page.tsx` — Today's Briefing: greeting, 4 metric tiles (Total AR, Critical jobs, Fell through cracks, Reps with heat), top-3 critical preview list

**Phase goal.** User can land, read about Vera, click into the dashboard, see today's briefing.

**Test.**
- E2E: `landing.spec.ts` (replace smoke) — hero renders, CTA navigates to `/dashboard`.
- E2E: `dashboard-overview.spec.ts` — metric tiles render with real numbers, all nav links work.
- Visual review on Vercel URL.

**Ship.**
```
git add -A
git commit -m "phase 4: landing + dashboard shell"
git push
```

---

## Phase 5 — Reports A: Reconciliation + Milestones

**Items.**
- `app/dashboard/reconciliation/page.tsx` — "fell through cracks" list with reason chips for each row, Vera narrative at top
- `app/dashboard/milestones/page.tsx` — per-job list with missing-step tags (cert of completion, final check, commission request)

**Phase goal.** The two simplest reports are live and read from API.

**Test.**
- E2E: `reconciliation.spec.ts` — list renders, reason chips correct against fixture.
- E2E: `milestones.spec.ts` — missing-step tags render correctly.
- Manual: walk both pages on the live URL.

**Ship.**
```
git add -A
git commit -m "phase 5: reconciliation + milestones"
git push
```

---

## Phase 6 — Reports B: Aging + Rep Report + Follow-ups

**Items.**
- `app/dashboard/aging/page.tsx` — TanStack Table with sort/group/filter, Tremor bucket bar chart, side panel with anomaly groupings, filters via `nuqs`
- `app/dashboard/rep-report/page.tsx` — leaderboard table (rank/rep/$/count/oldest/avg heat), top sortable bar chart, region + job-type filters, "Generate weekly digest" modal with email draft + copy
- `app/dashboard/follow-ups/page.tsx` — two tabs ("Rep Follow-ups" Hot 51–75, "Executive Review Queue" Critical 76+), heat badge breakdown tooltip, "Draft email" modal with copy + `mailto:`

**Phase goal.** Three richer reports live, including the email draft flow.

**Test.**
- E2E: `aging.spec.ts` — buckets render, sort works, filter persists in URL, anomaly chip tooltip opens.
- E2E: `rep-report.spec.ts` — leaderboard sorts, filters apply, "Generate weekly digest" modal renders a draft.
- E2E: `follow-ups.spec.ts` — heat badges show breakdowns, executive queue tab filters to Critical, email draft modal copies to clipboard.
- Manual: walk all three pages on the live URL.

**Ship.**
```
git add -A
git commit -m "phase 6: aging + rep-report + follow-ups"
git push
```

---

## Phase 7 — Chat

**Items.**
- `useChat` hook wired into the dashboard chat panel
- System prompt: Vera's persona + voice rules + AR scope guardrail + data context summary
- Tool use:
  - `getJob(id)` — pull a single AR job
  - `listJobs(filter)` — filter the AR set
  - `getRep(name)` — rep summary with totals
  - `draftFollowUpEmail(jobId)` — generate a draft
- "Ask Vera about this" buttons on report rows pre-seed the chat with context
- Token-streaming UI

**Phase goal.** Vera chat alive, grounded in data, AR-scoped.

**Test.**
- E2E: `chat.spec.ts` — open panel, send message, mocked response streams, off-topic deflected.
- Manual on live URL: "Who's worst this week?" → top rep returned. "Draft a follow-up for [job]" → email produced. "What's the weather?" → graceful deflection.

**Ship.**
```
git add -A
git commit -m "phase 7: chat"
git push
```

---

## Phase 8 — Polish + Final Deploy

**Items.**
- Loading states (skeleton screens in warm theme)
- Empty states ("Nothing's late today. I'll keep watching.")
- Error states ("I couldn't reach the data layer. I'll retry shortly.")
- Tooltips on every default decision (the 19 questions surface in UI)
- README.md at repo root with run + deploy instructions
- Final Playwright suite review
- Production smoke test (full walk-through against live URL)

**Phase goal.** Demo-ready production URL with full E2E coverage and visible defaults.

**Test.**
- `pnpm test:e2e` → all 8 specs green locally.
- Playwright against the live Vercel URL → all green.
- Manual demo run-through: landing → dashboard → each report → chat → email draft.

**Ship.**
```
git add -A
git commit -m "phase 8: polish + ready to demo"
git push
# → Final Vercel deploy
# → Smoke-test live URL
# → Hand off
```

---

## The loop, restated

```
┌─────────┐    ┌───────┐    ┌──────┐
│implement│ ─► │ test  │ ─► │ ship │ ─► next phase
└─────────┘    └───────┘    └──────┘
                              │
                              ▼
                  git push → Vercel auto-deploys
                  → live URL updated
                  → smoke check
```

Eight passes through the loop. Always green when we ship. Always live. Always demo-able by the end of every phase.

---

## Risk register

| Risk | Mitigation |
|---|---|
| Vercel build fails on preprocess (memory/time) | Streaming line-by-line keeps memory flat; expected runtime ~15s |
| Playwright flake from AI timing | AI mocked in CI; live AI test gated behind `RUN_LIVE_AI=1` |
| Chat hallucinates job details | Tool use forces grounded retrieval; system prompt forbids fabrication |
| One phase blows the time budget | Each phase is independently shippable — if Phase 6 takes too long, ship after 6a (aging only), demo what's live |
| Defaults feel wrong on real data | Every default surfaces in the UI as a tooltip/footnote, easy to challenge in the demo |
