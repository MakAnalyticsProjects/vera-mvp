# Understanding the lineitems backfill — from zero

This doc is for understanding *why* the backfill is slow and *what* the proposed fixes actually do, in plain language. No backend background required. Read top to bottom.

---

## Part 1: The cast of characters

Three pieces of software are involved. Let's name them.

```
┌─────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│   OUR APP           │    │   OUR DATABASE       │    │   ROOFLINK'S API     │
│   (Next.js, runs    │    │   (Neon, hosted      │    │   (external service  │
│    on your laptop   │←──→│    Postgres in       │    │    we don't own)     │
│    in dev)          │    │    the cloud)        │    │                      │
│                     │    │                      │    │                      │
│   The code we wrote │    │   Stores the data    │    │   Source of truth    │
│   that does stuff.  │    │   we've fetched      │    │   for Rooflink jobs  │
│                     │    │   and computed.      │    │   and estimates.     │
└─────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

- **Our app**: the Next.js code (`apps/web`) you've been working on. It runs on your laptop in dev, on Vercel in prod. When it needs data, it talks to the database or to Rooflink.
- **Our database**: a Postgres database hosted on Neon. Think of it as a giant spreadsheet living somewhere on the internet. We can ask it questions and it sends back answers.
- **Rooflink's API**: not ours. We can't change it. We send HTTP requests, Rooflink sends back JSON. Slow, rate-limited.

The communication is always over the network — never inside the same computer. That matters because **the network is slow** compared to local memory.

---

## Part 2: What we're trying to do

Two-stage goal:

**Stage 1 (done): Backfill the jobs.**
We asked Rooflink for every job it knows about. ~104,000 jobs. We saved each one as a row in our database, in a table called `RawRooflinkJob`. Each row stores the full JSON payload Rooflink sent back. This took ~4 hours (run #13).

**Stage 2 (the one we're stuck on): Backfill the line items.**
Each job *may* have an "estimate" attached — that's the quote document with all the details about the roof work. The line items are the breakdown of an estimate (this much for materials, this much labor, etc.).

Line items aren't in the bulk jobs endpoint. To get them, we have to ask Rooflink one estimate at a time: `GET /estimates/{id}/lineitems/`. We need to know the estimate's ID to ask.

So the loop is: *for each estimate ID we know, fetch its line items, save them to the database.*

---

## Part 3: Why ~8,500 and not 104,000

Of the ~104,000 jobs in our database, only about ~8,500 have an estimate attached. The other ~95,500 are jobs in earlier stages (leads, canceled, never quoted) — they have no estimate, so there's no `id` we can pass to `/estimates/{id}/lineitems/`.

```
┌─────────────────────────────────────────────────────────┐
│  RawRooflinkJob table (~103,947 rows)                   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │                                                 │    │
│  │  Jobs WITH a primary_estimate.id  ~  8,500      │    │
│  │  ← these are the ones we walk for lineitems     │    │
│  │                                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Jobs WITHOUT any estimate              ~ 95,400        │
│  (leads, dead, no quote attached → nothing to fetch)    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

This isn't us being selective. It's a hard fact of the data — you can't make an API call to `/estimates/null/lineitems/`. The 8,500 number is the total amount of work we have to do, no way around it.

---

## Part 4: How our code finds those 8,500 IDs (the buggy part)

Before our app can make ANY call to Rooflink for line items, it needs the list of 8,500 estimate IDs. Where does that list come from? **From our own database** — it's hidden inside the 104k job records we already backfilled.

Each job's row looks (conceptually) like this:

```
A single row in RawRooflinkJob:
┌─────────────────────────────────────────────────┐
│ rooflinkId: "12345"                             │
│ dataVersion: 13                                 │
│ payload: {                                      │   ← this whole thing is ~50 KB of JSON
│   "id": 12345,                                  │     (the FULL Rooflink response for one job)
│   "address": "123 Main St",                     │
│   "customer": { "name": "Smith" },              │
│   "primary_estimate": { "id": 67890, ... },     │   ← we need just this id
│   "estimates": [...],                           │
│   "rep": { ... },                               │
│   "date_completed": "2026-04-15",               │
│   ...                                           │
│   ...lots more fields...                        │
│ }                                               │
└─────────────────────────────────────────────────┘
```

The thing we need to extract is `payload.primary_estimate.id` — one number, buried in ~50 KB of JSON.

Our code today says, roughly:

> "Database, please send me ALL the `payload` columns from `RawRooflinkJob` where dataVersion = 13. I'll dig through them myself."

That means the database sends:

```
~103,947 rows × ~50 KB each ≈ 5,000 MB (5 GB) of data over the network
```

Then our code, running on your laptop, opens each payload, finds `primary_estimate.id`, drops the ~95,500 jobs that have no estimate, and ends up with a list of ~8,500 IDs.

**~99.997% of what the database sent us was thrown away.**

And here's the kicker: **our code does this EVERY tick.** Every ~70 seconds we re-ask the database for all 5 GB, just to derive the same list of 8,500 IDs. Across one full backfill: ~4,250 ticks × 5 GB = **~21,000 GB (21 TB) of wasted transfer**.

This is what just exhausted Neon's monthly data transfer quota in a few hours.

---

## Part 5: What is "SQL" and what does "cheap SQL" mean?

**SQL** stands for "Structured Query Language." It's the language we use to talk to a database. When our app says "give me data," it sends a SQL query, and the database responds with rows.

A SQL query is like a sentence. Our current one is:

```sql
SELECT payload
FROM "RawRooflinkJob"
WHERE "dataVersion" = 13
```

Translated to plain English: *"Give me the entire `payload` column for every row where dataVersion equals 13."*

That sentence says "give me everything." The database has no choice but to send all 5 GB.

A **smarter SQL query** can do the work on the database side and only send back what we actually need:

```sql
SELECT payload->'primary_estimate'->>'id' AS id
FROM "RawRooflinkJob"
WHERE "dataVersion" = 13
  AND payload->'primary_estimate'->>'id' IS NOT NULL
```

Plain English: *"For every row where dataVersion = 13, look inside the payload JSON, find `primary_estimate.id`, and give me just that. Skip rows where it's missing."*

The `payload->'primary_estimate'->>'id'` part is special Postgres syntax for "dig into the JSON and pull out this nested field." Postgres can do this server-side without sending the JSON anywhere.

**"Cheap SQL" just means: a SQL query that asks for less data because the work is done on the database before the answer is sent.**

Same result. Different cost.

---

## Part 6: "Server-side" vs "client-side" — what does that actually mean?

This trips a lot of people up. Let me draw it.

### Server-side filtering (what cheap SQL does)

```
                   THE DATABASE SERVER                       OVER THE NETWORK            OUR APP (your laptop)
                   ────────────────────                      ───────────────────         ─────────────────────

  Step 1:          [ 103,947 rows of data ]                                              [ asks for IDs ]
                                                                                              │
                                                          ←──── SQL query ────────────────────┘
                              │
                              ▼
  Step 2:        Filter: drop rows with no estimate
                              │
                              ▼
                  [ 8,500 rows remain ]
                              │
                              ▼
  Step 3:        Extract: pull out just the IDs
                              │
                              ▼
                  [ 8,500 small ID strings ]
                              │
                              ▼
                                                          ───── 150 KB of IDs ─────────────→ [ has the list ]
```

The filtering and extracting both happen INSIDE the database server. Only the final small list crosses the network.

### Client-side filtering (what our current code does)

```
                   THE DATABASE SERVER                       OVER THE NETWORK            OUR APP (your laptop)
                   ────────────────────                      ───────────────────         ─────────────────────

  Step 1:          [ 103,947 rows of data ]                                              [ asks for everything ]
                              │                                                                 │
                              │                            ←──── SQL query "give all" ──────────┘
                              │
                              ▼
                  [ 103,947 rows, full payloads ]
                              │
                              ▼
                                                          ───── 5 GB of JSON ─────────────→  [ loops through 103,947 ]
                                                                                                       │
                                                                                                       ▼
                                                                                              Step 2: in JavaScript,
                                                                                              filter out empty estimates
                                                                                                       │
                                                                                                       ▼
                                                                                                [ 8,500 rows left ]
                                                                                                       │
                                                                                                       ▼
                                                                                              Step 3: extract IDs
                                                                                                       │
                                                                                                       ▼
                                                                                                [ 8,500 ID strings ]
```

The filtering and extracting happen on our app — but only AFTER the database has shipped all 5 GB across the network.

**The key insight**: doing the work on the database (server-side) is faster *because the data is right there*. Doing it on our app (client-side) requires shipping the data across the network first, which is the expensive part.

It's the difference between asking a librarian "what books do you have about chess?" (server-side: they look at their shelves, tell you the titles) versus "send me every book in your library and I'll figure out which ones are about chess" (client-side: now you have to ship the whole library).

---

## Part 7: The current cost vs the cheap-SQL cost

For ONE call:

|  | What's transferred | How long it takes |
|---|---|---|
| **Current code** (client-side filtering) | 5 GB of full job payloads | ~30-60 seconds |
| **Cheap SQL** (server-side filtering) | ~150 KB of just IDs | ~1-2 seconds |

That's a 30,000× reduction in network data and ~50× reduction in time.

For a full lineitems backfill (~4,250 calls to this function):

|  | Total data transferred | Total time spent in this function |
|---|---|---|
| **Current code** | ~21 TB | ~70 hours |
| **Cheap SQL** | ~640 MB | ~1-2 hours |

---

## Part 8: What about caching?

Cache is a different kind of fix. Instead of making each call cheaper, it makes you call **less often**.

Imagine: even with cheap SQL, you still ask the database for the same 8,500 IDs ~4,250 times. The answer doesn't change between calls — it's the same list every time. So why ask 4,250 times? Why not ask once and remember the answer?

That's caching: **save the answer in memory, reuse it.**

```
Cheap SQL alone:                       Cheap SQL + cache:

  Tick 1: query DB → 1.5s                Tick 1: query DB → save in memory → 1.5s
  Tick 2: query DB → 1.5s                Tick 2: look in memory → 0s
  Tick 3: query DB → 1.5s                Tick 3: look in memory → 0s
  ...                                    ...
  Tick 4250: query DB → 1.5s             Tick 4250: look in memory → 0s
                                         
  Total: ~6,375 seconds                  Total: 1.5 seconds (one call total)
         (~1.7 hours)
```

So why would we *not* always add caching?

Two reasons:

1. **The savings only matter if the underlying call is slow.** Once we make the DB call cheap (1.5s), saving 1.5s × 4,249 = ~1.7 hours of cumulative time matters less than you'd think — most of the full backfill (3-6 hours) is spent waiting for Rooflink, not waiting for our database.

2. **Caches have a cost too**:
   - You have to remember to clear ("invalidate") the cache when the underlying data changes. If a new backfill promotes a new dataVersion, the cache becomes wrong unless we invalidate.
   - Caches don't survive cold starts. When the server restarts (Vercel does this all the time), the cache is gone. So the "free forever" claim is "free until the next cold start."
   - More code = more bugs.

**Cheap SQL is a strict win.** Cache is an *optional* additional win on top, but it adds complexity for a smaller payoff. For our scale right now, cheap SQL alone is enough.

---

## Part 9: Summary in two sentences

1. We're stuck because our code asks the database for ~5 GB of useless data on every tick, and we have ~4,250 ticks. Cumulatively: ~21 TB transferred for no reason.

2. The fix is to write a smarter SQL query that asks the database to filter and extract just the ~150 KB we actually need, server-side. ~30,000× less data per call, ~50× faster per call.

---

## Glossary (jargon → plain English)

- **Database / DB**: a giant managed spreadsheet living on a server. We store our app's data here.
- **Postgres / Neon**: our specific database. Postgres is the type; Neon is the company hosting it.
- **Row**: one entry in the database. Like one row in a spreadsheet.
- **Column**: one field of an entry. Like one column header in a spreadsheet.
- **Table**: a collection of related rows. Like one sheet in a spreadsheet workbook.
- **Payload**: in our case, the JSON blob in the `payload` column — the full data Rooflink returned for one job.
- **JSON**: a format for representing structured data. Looks like `{ "key": "value", "nested": { ... } }`.
- **JSONB**: Postgres's way of storing JSON efficiently, with support for indexing into it.
- **SQL**: the language for talking to a database. "Give me rows where X, sorted by Y."
- **Query**: one SQL request. "Show me all the rows where dataVersion = 13."
- **Server-side**: work that happens on the server (e.g., the database server, ~hundreds of miles away).
- **Client-side**: work that happens on your computer (the app).
- **Transfer / egress**: data being sent FROM the server TO your computer. Costs money on cloud platforms.
- **Tick**: in our backfill, one cycle of "fetch from Rooflink → write to DB → schedule next tick." A whole backfill is thousands of ticks chained together.
- **Cache**: storing the answer to an expensive question in memory so you don't have to re-ask.
- **Invalidation**: clearing a cached answer because you know it's no longer correct.
- **Cold start**: when a server boots from nothing. Caches are empty after a cold start.
