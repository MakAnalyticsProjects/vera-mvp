-- LiveJob: materialized view of the latest promoted RawRooflinkJob row per
-- (tenant, rooflinkId), with AR/write-offs filter fields AND the
-- duplicate-address count extracted as proper columns. This is the
-- dashboard's read table — reads no longer touch JSONB on the hot path.
--
-- Why a materialized view (vs a real table):
--   * Postgres maintains it via REFRESH MATERIALIZED VIEW CONCURRENTLY;
--     no upsert code to keep in sync.
--   * REFRESH CONCURRENTLY doesn't lock readers.
--   * Drop-and-recreate is safe: RawRooflinkJob is the source of truth.
--
-- Refresh trigger: the backfill tick worker calls
--   REFRESH MATERIALIZED VIEW CONCURRENTLY "LiveJob"
-- after each successful non-empty promote(). See lib/backfill/tick-worker.ts.

CREATE MATERIALIZED VIEW "LiveJob" AS
WITH deduped AS (
  SELECT DISTINCT ON (br."tenantId", r."rooflinkId")
    br."tenantId"                                                              AS "tenantId",
    r."rooflinkId"                                                             AS "rooflinkId",
    r.payload                                                                  AS payload,
    -- NULLIF on dateCompleted handles the rare case where Rooflink sends ''
    -- for an unset date — keeps the date cast from blowing up the refresh.
    NULLIF(r.payload->>'date_completed', '')::date                             AS "dateCompleted",
    NULLIF(r.payload->'primary_estimate'->>'balance', '')::numeric             AS balance,
    -- COALESCE is intentional: when `exclude_from_qb` is absent from the
    -- payload, the bare comparison `(payload->>'exclude_from_qb') = 'true'`
    -- evaluates to NULL. The old JSONB read treated absent-or-not-'true' as
    -- "not excluded" (i.e. include the row in AR); we preserve that by
    -- defaulting NULL to false here.
    COALESCE((r.payload->>'exclude_from_qb') = 'true', false)                  AS "excludeFromQb",
    r.payload->'primary_estimate'->>'id'                                       AS "primaryEstimateId",
    TRIM(LOWER(COALESCE(r.payload->>'full_address', r.payload->>'address', ''))) AS "normalizedAddress",
    r."fetchedAt"                                                              AS "fetchedAt",
    r."dataVersion"                                                            AS "dataVersion"
  FROM "RawRooflinkJob" r
  JOIN "BackfillRun" br
    ON br.id = r."dataVersion"
  WHERE br.promoted = true
    AND br.status = 'completed'
    AND br.source = 'rooflink_jobs'
  ORDER BY br."tenantId", r."rooflinkId", r."dataVersion" DESC
)
SELECT
  *,
  -- Cross-row context the domain transform needs: how many jobs in the
  -- live snapshot share this normalized address (per tenant). 1 = unique.
  CASE
    WHEN LENGTH("normalizedAddress") = 0 THEN 1
    ELSE COUNT(*) OVER (PARTITION BY "tenantId", "normalizedAddress")::int
  END                                                                          AS "addressDupCount"
FROM deduped;

-- REFRESH MATERIALIZED VIEW CONCURRENTLY requires a unique index on the
-- result. (tenantId, rooflinkId) is the natural key per the DISTINCT ON.
CREATE UNIQUE INDEX "LiveJob_tenant_rooflinkId_key"
  ON "LiveJob" ("tenantId", "rooflinkId");

-- AR working-set filter: dateCompleted IS NOT NULL AND balance > 0 AND NOT excludeFromQb.
-- Partial index keeps the on-disk size tiny (~127 rows in vera_dev) and
-- makes the AR query a pure index lookup.
CREATE INDEX "LiveJob_ar_partial_idx"
  ON "LiveJob" ("tenantId", "dateCompleted", balance)
  WHERE "dateCompleted" IS NOT NULL
    AND balance > 0
    AND "excludeFromQb" = false;

-- Write-offs scope filter: primaryEstimateId IS NOT NULL AND dateCompleted >= cutoff.
CREATE INDEX "LiveJob_writeoff_partial_idx"
  ON "LiveJob" ("tenantId", "dateCompleted")
  WHERE "primaryEstimateId" IS NOT NULL;
