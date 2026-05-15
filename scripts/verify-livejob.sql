-- LiveJob materialized view — OLD-vs-NEW equivalence verification.
--
-- Run after applying migration 20260515000000_add_livejob_materialized_view.
-- Reconstructs the OLD JSONB-reading logic (DISTINCT ON over RawRooflinkJob
-- + addr_counts CTE + AR filter + write-offs filter) as CTEs, then diffs
-- against the LiveJob materialized view across 5 dimensions:
--
--   1. dedup membership (every old (tenant, rooflinkId) present in LiveJob, vice versa)
--   2. dataVersion selected per key matches
--   3. AR working-set membership matches
--   4. addressDupCount column matches old addr_counts aggregation
--   5. write-offs candidate set matches (with the 2024-01-01 cutoff)
--
-- Any non-zero "*_mismatch" or "*_only_in_*" row is a real discrepancy.
-- STOP and investigate before continuing the deploy.
--
-- Read-only. Safe to run against vera_prod.

\timing on

WITH old_dedup AS (
  SELECT DISTINCT ON (br."tenantId", r."rooflinkId")
    br."tenantId"                AS "tenantId",
    r."rooflinkId"               AS "rooflinkId",
    r.payload                    AS payload,
    r."dataVersion"              AS "dataVersion"
  FROM "RawRooflinkJob" r
  JOIN "BackfillRun" br ON br.id = r."dataVersion"
  WHERE br.promoted = true
    AND br.status = 'completed'
    AND br.source = 'rooflink_jobs'
  ORDER BY br."tenantId", r."rooflinkId", r."dataVersion" DESC
),
old_addr_counts AS (
  SELECT
    "tenantId",
    TRIM(LOWER(COALESCE(payload->>'full_address', payload->>'address', ''))) AS addr,
    COUNT(*)::int AS cnt
  FROM old_dedup
  WHERE LENGTH(TRIM(COALESCE(payload->>'full_address', payload->>'address', ''))) > 0
  GROUP BY 1, 2
),
old_ar AS (
  SELECT "tenantId", "rooflinkId"
  FROM old_dedup
  WHERE (payload->>'exclude_from_qb' IS NULL OR payload->>'exclude_from_qb' != 'true')
    AND payload->>'date_completed' IS NOT NULL
    AND (payload->'primary_estimate'->>'balance')::numeric > 0
),
new_ar AS (
  SELECT "tenantId", "rooflinkId"
  FROM "LiveJob"
  WHERE "dateCompleted" IS NOT NULL
    AND balance > 0
    AND "excludeFromQb" = false
),
old_wo AS (
  SELECT "tenantId", "rooflinkId"
  FROM old_dedup
  WHERE payload->'primary_estimate'->>'id' IS NOT NULL
    AND payload->>'date_completed' IS NOT NULL
    AND (payload->>'date_completed')::date >= '2024-01-01'::date
),
new_wo AS (
  SELECT "tenantId", "rooflinkId"
  FROM "LiveJob"
  WHERE "primaryEstimateId" IS NOT NULL
    AND "dateCompleted" IS NOT NULL
    AND "dateCompleted" >= '2024-01-01'::date
)
SELECT 'old_dedup_count'       AS check, COUNT(*)::text AS value FROM old_dedup
UNION ALL SELECT 'livejob_count', COUNT(*)::text FROM "LiveJob"
UNION ALL SELECT 'dedup_only_in_old', COUNT(*)::text
  FROM old_dedup o
  LEFT JOIN "LiveJob" lj ON lj."tenantId" = o."tenantId" AND lj."rooflinkId" = o."rooflinkId"
  WHERE lj."rooflinkId" IS NULL
UNION ALL SELECT 'dedup_only_in_new', COUNT(*)::text
  FROM "LiveJob" lj
  LEFT JOIN old_dedup o ON o."tenantId" = lj."tenantId" AND o."rooflinkId" = lj."rooflinkId"
  WHERE o."rooflinkId" IS NULL
UNION ALL SELECT 'data_version_mismatch', COUNT(*)::text
  FROM old_dedup o
  JOIN "LiveJob" lj ON lj."tenantId" = o."tenantId" AND lj."rooflinkId" = o."rooflinkId"
  WHERE o."dataVersion" <> lj."dataVersion"
UNION ALL SELECT 'ar_old_count', COUNT(*)::text FROM old_ar
UNION ALL SELECT 'ar_new_count', COUNT(*)::text FROM new_ar
UNION ALL SELECT 'ar_only_in_old', COUNT(*)::text
  FROM old_ar oa
  LEFT JOIN new_ar na ON na."tenantId" = oa."tenantId" AND na."rooflinkId" = oa."rooflinkId"
  WHERE na."rooflinkId" IS NULL
UNION ALL SELECT 'ar_only_in_new', COUNT(*)::text
  FROM new_ar na
  LEFT JOIN old_ar oa ON oa."tenantId" = na."tenantId" AND oa."rooflinkId" = na."rooflinkId"
  WHERE oa."rooflinkId" IS NULL
UNION ALL SELECT 'address_count_mismatch', COUNT(*)::text
  FROM old_dedup o
  JOIN "LiveJob" lj ON lj."tenantId" = o."tenantId" AND lj."rooflinkId" = o."rooflinkId"
  LEFT JOIN old_addr_counts oac
    ON oac."tenantId" = o."tenantId"
    AND oac.addr = TRIM(LOWER(COALESCE(o.payload->>'full_address', o.payload->>'address', '')))
  WHERE COALESCE(oac.cnt, 1) <> lj."addressDupCount"
UNION ALL SELECT 'writeoffs_old_count', COUNT(*)::text FROM old_wo
UNION ALL SELECT 'writeoffs_new_count', COUNT(*)::text FROM new_wo
UNION ALL SELECT 'writeoffs_only_in_old', COUNT(*)::text
  FROM old_wo o LEFT JOIN new_wo n USING ("tenantId", "rooflinkId")
  WHERE n."rooflinkId" IS NULL
UNION ALL SELECT 'writeoffs_only_in_new', COUNT(*)::text
  FROM new_wo n LEFT JOIN old_wo o USING ("tenantId", "rooflinkId")
  WHERE o."rooflinkId" IS NULL;
