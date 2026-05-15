-- Hotfix for the automation-rules deploy (2026-05-15).
--
-- The original migration (20260515150000_add_automation_rules) ran via
-- `prisma migrate deploy` using the postgres admin connection, so the new
-- AutomationRule / RuleEvaluationState / PendingRuleSend tables inherited
-- postgres as their owner. The runtime application uses the scoped
-- `vera_app` role, which has no DML on those tables until this grant
-- lands — every /dashboard/scheduler?tab=automation read and every
-- /api/automation-rules* mutation would return
-- `ERROR: permission denied for table <name> (code 42501)`.
--
-- Same pattern as 20260515160000_grant_livejob_select_to_vera_app.
--
-- DO blocks make this idempotent against environments where vera_app
-- doesn't exist (a fresh local dev DB owned by the OS user).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vera_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "AutomationRule" TO vera_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "RuleEvaluationState" TO vera_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "PendingRuleSend" TO vera_app';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE "AutomationRule_id_seq" TO vera_app';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE "RuleEvaluationState_id_seq" TO vera_app';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE "PendingRuleSend_id_seq" TO vera_app';
  END IF;
END $$;
