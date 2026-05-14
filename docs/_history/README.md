# Historical plans

These are point-in-time planning docs for work that has shipped. They're
preserved because they capture the reasoning behind decisions and what we
thought we were doing before we did it — useful when revisiting the same
problem space later, or when someone joins the project and wants to know
"why is it like that?"

Nothing here describes how the system **currently** works. For that, see
[`../ARCHITECTURE.md`](../ARCHITECTURE.md), [`../DATA_MODEL.md`](../DATA_MODEL.md),
and [`../OPERATIONS.md`](../OPERATIONS.md).

| File | What it was | Shipped |
|---|---|---|
| [`PLAN.md`](PLAN.md) | Original 8-phase execution plan from empty repo to demo | 2026-05-05 |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | "How we'll build it" plan after the May 7 sync with Israel | 2026-05-07 |
| [`DATA_SOURCE_MIGRATION.md`](DATA_SOURCE_MIGRATION.md) | Brief for the `generated.json` → DB cutover | 2026-05-14 |
| [`PHASE_A_LOCAL_CUTOVER_PLAN.md`](PHASE_A_LOCAL_CUTOVER_PLAN.md) | Local DB-cutover verification plan | 2026-05-13 |
| [`BACKFILL_SCHEDULING_design.md`](BACKFILL_SCHEDULING_design.md) | Design doc for the backfill schedule/run state machine | 2026-05-12 |
