-- Migrate SendLog.toEmail (TEXT, NOT NULL) → SendLog.toEmails (TEXT[])
-- Same shape as the Schedule.recipients migration — add nullable-by-default
-- array, backfill from the scalar column, then drop the scalar.
ALTER TABLE "SendLog" ADD COLUMN "toEmails" TEXT[] NOT NULL DEFAULT '{}';
UPDATE "SendLog"
   SET "toEmails" = ARRAY["toEmail"]
 WHERE "toEmail" IS NOT NULL AND "toEmail" <> '';
ALTER TABLE "SendLog" DROP COLUMN "toEmail";
ALTER TABLE "SendLog" ALTER COLUMN "toEmails" DROP DEFAULT;
