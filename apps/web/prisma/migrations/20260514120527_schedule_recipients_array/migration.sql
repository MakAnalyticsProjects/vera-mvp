-- Migrate Schedule.recipient (TEXT, NOT NULL) → Schedule.recipients (TEXT[])
-- Adds the new array column with a default, copies existing scalar values into
-- single-element arrays, then drops the old scalar column. The default is
-- removed at the end so the application layer owns the value going forward.
ALTER TABLE "Schedule" ADD COLUMN "recipients" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "Schedule"
   SET "recipients" = ARRAY["recipient"]
 WHERE "recipient" IS NOT NULL AND "recipient" <> '';
ALTER TABLE "Schedule" DROP COLUMN "recipient";
ALTER TABLE "Schedule" ALTER COLUMN "recipients" DROP DEFAULT;

-- BackfillSchedule never had a recipient column — add the array fresh.
ALTER TABLE "BackfillSchedule" ADD COLUMN "recipients" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "BackfillSchedule" ALTER COLUMN "recipients" DROP DEFAULT;
