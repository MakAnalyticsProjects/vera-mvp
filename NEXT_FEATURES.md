# Vera MVP — Phase 2 plan

Brandon's post-demo asks, broken into shippable units. Each item lists scope, approach, effort, and (where the spec is unclear) clarifying questions.

---

## 1 · Card height uniformity

**Where it bites:** `/dashboard/milestones`, `/dashboard/follow-ups`, `/dashboard/reconciliation`. Cards in a vertical list have different content lengths (1 vs 3 missing-step tags, 0 vs 4 reasons lines, etc.) and the resulting variable heights look ragged.

**Approach options:**

| Option | Trade-off |
|---|---|
| **A. Fixed grid heights** — cap every row card at e.g. `min-h-[140px]` and truncate overflow content with `…` | Tidy, but hides real signal — exactly the rows with most missing tags are the ones that get cut |
| **B. Move all three to the Table primitive** | Tables already auto-size rows uniformly per page; this matches what we did to milestones earlier. Hard part: follow-ups has the Draft-email action button per row, reconciliation has the 4-line reasons list |
| **C. Two-line clamp** — let cards grow to fit the first ~2 lines of variable content, clip the rest with a "+ N more" indicator | Compromise; preserves the worst-offender visibility |

**My read:** **Option B** for milestones (already done) and reconciliation; **Option C** for follow-ups (the Draft-email button + missing-step tags need vertical room). Both will look uniform on screen.

**Clarifying Q:**
- 1.1 — Reconciliation: the per-job "reasons" list (no insurance check / no cert / no commission / record untouched for X days) is up to 4 short lines. Convert to a dense table column with badges, or keep the explanatory list and just cap the card height?
- 1.2 — Follow-ups: should the Draft-email button move from inline-on-row to "click a row to open a sheet, draft email lives in the sheet"? That removes the button-in-row variability completely.

**Effort:** ~1 hour

---

## 2 · Ask Vera — attention + entrance animation, possibly centered modal

**Where it bites:** the floating "Ask Vera" pill at bottom-right is easy to miss. Brandon wants it to *invite* a click.

**Approach:**

- **(a) Subtle pulse on the FAB** — gentle ring animation around the button on first view, decaying after ~5s or one click.
- **(b) Optional first-visit nudge** — small tooltip-style callout pointing at the FAB once per session, e.g. "Ask Vera anything →"
- **(c) Entrance animation when opening** — currently the chat fades; bump to a slide+scale entrance with a noticeable "settle" easing.
- **(d) Re-evaluate side-sheet vs centered modal** — the chat IS conversational which is what side panels are usually for; centered modal is more "ChatGPT-style" but eats the dashboard underneath. **My recommendation:** keep the side sheet (already matches JobDetailSheet in style and respects "let me reference the dashboard while chatting"), but make the FAB obviously alive and the open transition rich.

**Clarifying Q:**
- 2.1 — Which feel: pulsing FAB (default-on, decays after first click) or once-per-session tooltip-callout, or both?
- 2.2 — Side sheet vs centered modal — strongly preferring side sheet myself; please confirm before I lock that in.

**Effort:** ~1 hour

---

## 3 · Rep Outstanding → Rep Leaderboard

**The ask:** turn the current Rep Outstanding view into a richer leaderboard with multiple metrics and multiple time periods.

**What we can compute from the data we have:**

| Metric | Have it? | Notes |
|---|---|---|
| Total outstanding balance | ✅ already shown | |
| AR job count | ✅ already shown | |
| Oldest aging | ✅ already shown | |
| Average heat score | ✅ already shown | |
| Hot · Critical job counts | ✅ already shown | |
| Total install value (period) | ✅ derivable | Sum of `gt_price` for jobs with `date_completed` in period |
| Total commissions earned (period) | ✅ derivable | Sum of `commissions` for jobs in period |
| Number of installs completed (period) | ✅ derivable | Count of `date_completed` in period |
| Total revenue collected (period) | ⚠️ approximation only | We have `payments` field (lifetime per estimate) but no payment timestamps — can't truly bucket by period |

**What we cannot compute without more data:**

| Metric | Why not |
|---|---|
| Collection speed (days from invoice to paid) | No invoice-sent or payment-received dates |
| Month-over-month change | No historical snapshots |
| Conversion rate (lead → close) | RoofLink export only has installed jobs in our slice; we'd need full pipeline |

**Periods we can support:** `last 30 days · last 90 days · last 12 months · all-time` — all driven off `date_completed`.

**Proposed UI:**

- Top of page: two pickers — **Metric** (dropdown, ~7 options) + **Period** (chip group, 4 options).
- Top-10 chart updates to the chosen metric.
- Leaderboard table changes its primary column to the metric, with secondary columns showing the others as context.
- URL-driven (`/dashboard/rep-report?metric=commissions&period=90d`) so the view is shareable.

**Clarifying Qs:**
- 3.1 — Confirm the 7-metric set: total outstanding, AR job count, oldest aging, avg heat, install value (period), commissions (period), install count (period). Anything else you want?
- 3.2 — `total revenue collected (period)` — we can fake it by attributing the LIFETIME `payments` to the period the job was installed in. It's not technically accurate but it's directionally correct. Include it with a footnote, or drop it?
- 3.3 — Period options: `30d / 90d / 12m / all-time` — OK or do you want different windows (`7d`, `52w`, `YTD`, etc.)?
- 3.4 — Do you want the page renamed to "Rep Leaderboard" everywhere (sidebar, h1, URL), or keep `/dashboard/rep-report` and just rename the heading?

**Effort:** ~3–4 hours

---

## 4 · Filters in the top-right of every table

**The ask:** a filter button per table that opens a menu, narrowing what's shown.

**Approach:**

- New `<TableToolbar>` slot above each table (lives inside `TableShell`'s outer `<Card>` chrome, top-right).
- New shared `<FilterMenu>` component: a popover triggered by a button with `Filter` icon + count badge ("Filters · 2"). Inside: stacked filter groups (rep, region, job type, etc.) with multi-select chips.
- Filter state lives in URL search params (using `nuqs`, already in deps) so URLs are shareable and refreshable.
- "Clear filters" button when any filter is active.

**Per-page filter dimensions (proposed):**

| Page | Filters |
|---|---|
| `/dashboard/aging` | Bucket, rep, region, job type, anomaly type |
| `/dashboard/milestones` | Rep, region, missing-milestone type |
| `/dashboard/follow-ups` | Heat band, rep, region |
| `/dashboard/rep-report` | (already has region + job type — just move them into the new `FilterMenu`) |
| `/dashboard/reconciliation` | Rep, region, days-stuck range |

**Clarifying Qs:**
- 4.1 — Multi-select within each dimension (e.g. select 3 reps at once), or single-select?
- 4.2 — Should the FilterMenu also include a quick-search input at the top (search address / customer / rep name)? Adds a lot of utility but is a separate UX decision.
- 4.3 — When filters are applied, should the metric tiles at the top of each page update to reflect the filtered set, or stay representing the full AR universe? My read: tiles stay full (so you have a constant baseline) and only the table filters. Confirm?

**Effort:** ~3–4 hours (one shared component, applied 5 places)

---

## 5 · Pagination for every table

**The ask:** instead of one long scroll-locked table of 130 rows, paginate.

**Approach:**

- New `<TablePagination>` strip below each table: page size selector (10 / 25 / 50 / 100) + page nav (`‹ Prev · 1 2 3 … · Next ›`) + "Showing 26–50 of 130".
- Page state in URL (`?page=2&pageSize=25`) with `nuqs`.
- Default page size: **25** (feels right for a desk workflow).
- Internal scroll on the table can stay (in case 25 rows is taller than the viewport on small screens), but the dominant interaction becomes paging.

**Where it applies:** aging, milestones, rep leaderboard tables. For follow-ups and reconciliation (card lists), same pattern but applied to the list.

**Clarifying Q:**
- 5.1 — Default page size: 25 OK, or you want 10 (denser per-page) or 50 (less paging)?

**Effort:** ~2 hours (one shared component, applied 5 places)

---

## Total effort estimate

~10–12 hours of focused work, sequenced as:

1. (1h) Card height uniformity → milestones already done; do reconciliation + follow-ups
2. (1h) Ask Vera FAB animation + open-transition polish
3. (3–4h) Rep Leaderboard expansion (metrics + periods + chart/table swap)
4. (3–4h) Shared FilterMenu component + apply to 5 pages
5. (2h) Shared TablePagination component + apply to 5 pages
6. Final Playwright sweep + visual audit + deploy

Plus a chunk of new Playwright specs for: filter behavior, pagination behavior, leaderboard metric/period switching, FAB animation visibility.

---

## What I need from you

Five clarifying questions inline above (1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 5.1) — answer them and I'll lock the plan, then start executing in the order above.

Or: if any of the answers feel like "yeah whatever, your call," tell me which numbers to default-decide and I'll move on those without bothering you again.
