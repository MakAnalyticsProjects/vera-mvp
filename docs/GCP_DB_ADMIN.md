# GCP Cloud SQL — admin guide

How to operate the production database. Connection, roles, common queries,
and what to do when something is off.

> Last updated: 2026-05-14

---

## The DB at a glance

| | Value |
|---|---|
| Host | `34.56.121.151` |
| Port | `5432` |
| Postgres version | 16.13 (Debian) |
| Database name | `vera_prod` |
| App role | `vera_app` (owner of `vera_prod` and its `public` schema) |
| Admin role | `postgres` (CREATEDB + CREATEROLE; not a true superuser per Cloud SQL convention) |
| SSL | Required (`sslmode=require` in connection strings) |
| Authorized networks | `0.0.0.0/0` — protected by SSL + scoped role + 42-char random password |

The instance is **shared** with several other databases owned by other
teams: `bap_dev`, `priority_crm_test_db`, `authentication_service_db`,
`quickbooks_data`, `airflow_dev`. The `vera_app` role has zero access to
any of them — our blast radius stops at `vera_prod`.

---

## Connection recipes

### As the app role (read + write, scoped to `vera_prod`)

```bash
psql "host=34.56.121.151 port=5432 user=vera_app dbname=vera_prod sslmode=require"
# password prompt — paste from /tmp/vera_app_password.txt or Vercel env
```

For one-off connection-string pasting (more typing-friendly):

```bash
export DATABASE_URL='postgresql://vera_app:<pwd>@34.56.121.151:5432/vera_prod?sslmode=require'
psql "$DATABASE_URL"
```

### As the admin role (for DDL, role changes, cross-DB visibility)

Only from your laptop. Never on Vercel.

```bash
PGPASSWORD='<admin-pwd>' psql "host=34.56.121.151 port=5432 user=postgres dbname=postgres sslmode=require"
```

From there you can `\l` to see all databases, `\du` for all roles, etc.

---

## Common queries

### Inventory

```sql
-- All tables in vera_prod
\dt

-- Row counts at a glance
SELECT
  schemaname,
  relname,
  n_live_tup AS rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Database size + per-table size
SELECT pg_size_pretty(pg_database_size('vera_prod')) AS total;
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;
```

### Backfill state

```sql
-- The currently-live snapshot per source
SELECT id, source, status, mode, "itemsProcessed", "startedAt"
FROM "BackfillRun"
WHERE promoted = true AND status = 'completed'
ORDER BY id;

-- Most recent runs across all states
SELECT id, source, status, mode, promoted,
       "itemsProcessed", "itemsTotal",
       "consecutiveErrors", "lastError",
       "startedAt", "finishedAt"
FROM "BackfillRun"
ORDER BY id DESC
LIMIT 20;

-- How many distinct records are live for the metrics dashboard
SELECT count(DISTINCT "rooflinkId") AS live_jobs
FROM "RawRooflinkJob"
WHERE "dataVersion" IN (
  SELECT id FROM "BackfillRun"
  WHERE promoted=true AND status='completed' AND source='rooflink_jobs'
);
```

### Audit log

```sql
-- Recent activity, any category
SELECT "createdAt", category, action, summary, "userEmail"
FROM "AuditLog"
ORDER BY id DESC
LIMIT 25;

-- Just backfill events
SELECT "createdAt", action, summary
FROM "AuditLog"
WHERE category = 'backfill'
ORDER BY id DESC
LIMIT 25;
```

### Emails sent

```sql
SELECT "sentAt", cadence, "toEmail", status, "resendId", "pdfBytes"
FROM "SendLog"
ORDER BY id DESC
LIMIT 20;
```

`resendId` is the Resend message id. Visit `https://resend.com/emails/<id>`
for the delivery details (opens, bounces, etc.).

### Users

```sql
SELECT id, email, "tenantId", role, "createdAt"
FROM "User"
ORDER BY "createdAt" DESC;
```

---

## Creating a new app role (e.g. for a second environment)

If we ever need a staging environment (today we don't), the recipe is:

```sql
-- As postgres
CREATE DATABASE vera_staging WITH ENCODING 'UTF8';
CREATE USER vera_staging_app WITH LOGIN PASSWORD '<generated-pwd>';
GRANT vera_staging_app TO postgres;   -- so postgres can ALTER OWNER
ALTER DATABASE vera_staging OWNER TO vera_staging_app;

-- Connect to the new DB
\c vera_staging
ALTER SCHEMA public OWNER TO vera_staging_app;
GRANT ALL ON SCHEMA public TO vera_staging_app;
```

Then apply Prisma migrations to it:

```bash
DATABASE_URL='postgresql://vera_staging_app:<pwd>@34.56.121.151:5432/vera_staging?sslmode=require' \
  pnpm --filter @vera/web prisma migrate deploy
```

---

## Backups and recovery

GCP Cloud SQL takes **automatic daily backups** retained for 7 days
(default). The point-in-time-recovery window is 7 days too. To restore:

1. GCP Console → Cloud SQL → instance → **Backups** tab → pick the
   backup you want.
2. **Restore** → choose target DB (could be a new DB you create for the
   purpose, or overwrite `vera_prod`).
3. Wait ~5–15 min for the restore to complete.

**Don't restore over the live `vera_prod` without thinking very hard.**
The app will see inconsistent data during the restore window. Prefer:

1. Restore to a new DB (`vera_prod_restore`).
2. Verify the restored data.
3. Cut traffic over via `DATABASE_URL` swap on Vercel, redeploy.
4. Drop the old DB once stable.

For data-loss scenarios that only touch a few rows (e.g. someone
accidentally deleted a `Schedule`), pull from the audit log's `details.before`
snapshot and INSERT manually instead of running a full restore.

---

## Privilege model recap

```
postgres (admin role, on the shared GCP instance)
├── CREATEDB + CREATEROLE
├── owns nothing in vera_prod by default
└── can ALTER any database on the instance

vera_app (application role)
├── owns vera_prod and its public schema
├── full CRUD on every table in vera_prod
└── no access to any other database on the instance
```

The app **only** ever connects as `vera_app`. The `postgres` role is for
admin tasks from a laptop. If a Vercel env var ever shows `user=postgres`
in `DATABASE_URL`, that's a misconfiguration — rotate immediately.

---

## When to NOT touch the DB

Read the [`CLAUDE.md`](../CLAUDE.md) rule 9 carefully. The short version:

- Read queries (`SELECT`, `EXPLAIN`): freely.
- One-row mutations: with care, narrate what you're doing first.
- Multi-row mutations: only with explicit user ACK.
- DDL changes: should go through Prisma migrations, not ad-hoc `ALTER`.
- `TRUNCATE` / `DROP TABLE`: only as part of a documented disaster
  recovery procedure with user ACK.

The audit log is your friend — if something looks off, check `AuditLog`
to see what was done and by whom before reaching for a `DELETE`.

---

## Useful psql tips

| Command | What it does |
|---|---|
| `\dt` | List tables |
| `\d "TableName"` | Describe table (note the quotes — Prisma uses CamelCase identifiers) |
| `\du` | List roles |
| `\l` | List databases on the instance |
| `\c vera_prod` | Switch to `vera_prod` (when admin'ing across DBs) |
| `\timing on` | Show duration of each query |
| `\x` | Toggle expanded display (single-row queries look much better) |
| `\q` | Quit |

Always `\q` your session when you're done — Cloud SQL has a connection
limit, and idle psql sessions consume slots.
