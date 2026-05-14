# Sync-complete email + PDF report

Every successful Rooflink backfill emails the configured ops recipient
with a PDF summary of the records the run touched. This doc walks the
pipeline end-to-end.

> Last updated: 2026-05-14

---

## What an operator sees

After a backfill completes, an email lands in the configured recipient's
inbox with subject like:

> **Vera · data sync complete — Rooflink jobs (incremental, 42 records)**

The body is a short summary table:

| Source | Rooflink jobs |
|---|---|
| Mode | Incremental |
| Records updated | 42 |
| Duration | 2 min 14 s |
| Run reference | #156 |
| Attached report | sync-156-rooflink_jobs-incremental.pdf |

A PDF is attached. Opening it shows a one-or-multi-page report:
- **Header tiles:** mode badge + total records touched + total balance
  for those records.
- **Body table:** one row per touched record, with the most operationally
  useful fields per source (job number, customer name, address, install
  date, balance for jobs; estimate id, customer, work-RCV total, withheld
  amount for line items).
- **Footer:** "Showing first 200 of N records — see the dashboard for
  the rest" when more than 200 records touched.

The visual language mirrors the daily AR brief PDF so operators don't
context-switch between two design idioms.

---

## When the email fires

Exactly one email per **successful** `BackfillRun` completion. Specifically:

- ✅ `status = 'completed'` AND `promoted = true` AND `itemsProcessed >= 0` → email sends
- ❌ `status = 'completed'` AND `itemsProcessed = 0` → email sends with an "Empty
  incremental — no new records since last sync" body and **no PDF**
- ❌ `status = 'failed'` → email sends to the *failure* recipient
  (`FailureNotificationSetting.opsEmail`), with the last error message
  inline
- ❌ `status = 'canceled'` → no email (the operator cancelled deliberately)

The cron-fired and the Run-now paths both go through the same
`notifySuccess` / `notifyFailure` helpers in
[apps/web/lib/backfill/tick-worker.ts](../apps/web/lib/backfill/tick-worker.ts).

## Where the email goes

| Outcome | Recipient |
|---|---|
| Success | `BackfillSchedule.recipient` for scheduled runs; falls back to `FailureNotificationSetting.opsEmail` for Run-now or schedules without an explicit recipient |
| Failure | `FailureNotificationSetting.opsEmail` always |

Without an `opsEmail` configured for the tenant, scheduled runs still go
to the schedule's recipient; Run-now runs log a warning and skip the email.

---

## How the PDF is built

```mermaid
flowchart LR
  TW[tick-worker.ts<br/>notifySuccess] --> BSD[lib/sync-summary-data.ts<br/>buildSyncSummaryData]
  BSD -->|reads| DB[(RawRooflinkJob /<br/>RawRooflinkLineItems<br/>where dataVersion = run.id)]
  BSD --> Slim["Slim rows<br/>(top 200 by balance / work-RCV)"]
  Slim --> Render[lib/sync-summary-pdf.tsx<br/>renderSyncSummaryPDF]
  Render -->|@react-pdf/renderer| Buffer["Buffer<br/>(~5-50 KB)"]
  Buffer --> TW
  TW -->|sendEmail attachments| Resend
```

1. **`buildSyncSummaryData(runId, source)`** queries `RawRooflinkJob` or
   `RawRooflinkLineItems` filtered to the run's `dataVersion`. Projects
   each payload into a slim row shape; caps at 200 rows ordered by balance
   (jobs) or work-RCV total (line items). Returns counts, totals, and
   the slim row list.
2. **`renderSyncSummaryPDF(data)`** uses `@react-pdf/renderer` to render
   the JSX-defined report into a Buffer. In-process, no Chromium. Single
   page when ≤ ~25 rows, multi-page otherwise.
3. **`sendEmail({ to, subject, html, attachments })`** is the same helper
   used for daily AR briefs. Resend handles delivery.

PDF errors are **non-fatal** — if the PDF render throws, the email still
goes out with a warning in the body ("PDF summary failed to generate; see
dashboard for run details"). A `console.warn` records why.

---

## On-demand regeneration

Sometimes you want the PDF without re-running the backfill (e.g.
forwarding a report to a stakeholder a week later). The route handles
that:

```
GET /api/backfills/[source]/runs/[id]/sync-summary
```

- Auth-gated via `withAuth` (must be signed in to the tenant).
- Returns `application/pdf` with `Content-Disposition: attachment`.
- Renders fresh — doesn't cache.

---

## Previewing the email shape (no backfill needed)

For design iteration there's a preview script that sends three sample
variants to a fixed recipient:

```bash
NODE_OPTIONS="--require ./scripts/_server-only-shim.cjs" \
  pnpm exec tsx scripts/send-sync-email-preview.ts
```

Sends three emails to `adityauphade@makanalytics.org`:
1. Empty incremental (no PDF).
2. Small incremental (5 records, single-page PDF, ~5 KB).
3. Large full sync (200 records, multi-page PDF, ~45 KB).

Requires `RESEND_API_KEY` in `apps/web/.env.local`. Useful for confirming
PDF layout changes before merging.

---

## When something is off

| Symptom | Likely cause | What to check |
|---|---|---|
| Email arrived but no PDF | `renderSyncSummaryPDF` threw — non-fatal path triggered | Vercel function logs for "PDF render failed" warning; common: payload schema drift |
| No email at all after a completed run | `RESEND_API_KEY` missing OR the recipient field is empty | `vercel env ls | grep RESEND`; check `BackfillSchedule.recipient` and `FailureNotificationSetting.opsEmail` |
| PDF attached but no table data | Run completed with `itemsProcessed=0` (incremental with nothing changed) | Expected behavior — operator should see the "no new records" body copy |
| PDF cut off at 200 rows but the run touched 5,000 | The 200-row cap is intentional | Use the dashboard to see all records; this is a design decision, not a bug |
| Email subject says "incremental" but operator expected "full" | Mode is decided at run creation time | See [`OPERATIONS.md#trigger-a-rooflink-backfill`](OPERATIONS.md#trigger-a-rooflink-backfill); use `?mode=full` to force |
