/**
 * Import a regional "Installs & Payments" spreadsheet (exported to CSV) into
 * the local `vera_dev` Postgres `InstallPayment` table.
 *
 * Source: a hand-kept Google Sheet Israel maintains per market/month, e.g.
 * `data/Dallas - Installs & Payments - May 2026.csv`. NOT Rooflink data — the
 * sheet is the source of truth and is shown read-only on /dashboard/installs.
 *
 * Parsing (header/annotation/blank-row skipping, money + date cells) lives in
 * `parse-install-payments.ts`, shared with the Playwright seed generator so
 * both read the sheet identically.
 *
 * Behaviour:
 *   - Idempotent: upserts on the natural key (tenantId, region, sourcePeriod,
 *     sourceRow) where sourceRow is the 1-based CSV line number. Re-running the
 *     same file overwrites in place rather than duplicating.
 *
 * Run (targets local vera_dev):
 *   pnpm exec tsx scripts/import-install-payments.ts \
 *     "data/Dallas - Installs & Payments - May 2026.csv" --region Dallas --period 2026-05
 *
 * Defaults to the Dallas May-2026 file + region/period if no args are given.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import {
  parseInstallPaymentsAnnotation,
  parseInstallPaymentsCsv,
} from './parse-install-payments';

const { Client } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TENANT_ID = 1;

function parseArgs(argv: string[]): {
  file: string;
  region: string;
  period: string;
} {
  let file = 'data/Dallas - Installs & Payments - May 2026.csv';
  let region = 'Dallas';
  let period = '2026-05';
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--region') region = argv[++i] ?? region;
    else if (a === '--period') period = argv[++i] ?? period;
    else positional.push(a);
  }
  if (positional[0]) file = positional[0];
  return { file, region, period };
}

async function main(): Promise<void> {
  const { file, region, period } = parseArgs(process.argv.slice(2));
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);
  const text = readFileSync(abs, 'utf8');
  const parsed = parseInstallPaymentsCsv(text);
  const meta = parseInstallPaymentsAnnotation(text);

  console.log(
    `Parsed ${parsed.length} install rows from ${path.basename(abs)}. ` +
      `region=${region} period=${period} ` +
      `reviewed=${meta.reviewedLabel ?? '—'} note=${meta.clearingNote ?? '—'}`,
  );

  // Local runs hit vera_dev by default. For the one-time prod import, set
  // DATABASE_URL (from .env.prod) to point the same script at vera_prod.
  const connectionString = process.env.DATABASE_URL;
  const c = connectionString
    ? new Client({ connectionString })
    : new Client({ host: 'localhost', port: 5432, user: 'aditya.uphade', database: 'vera_dev' });
  await c.connect();
  console.log(connectionString ? '— Connected via DATABASE_URL —' : '— Connected to local vera_dev —');

  let upserted = 0;
  for (const p of parsed) {
    await c.query(
      `INSERT INTO "InstallPayment"
         ("tenantId","region","sourcePeriod","sourceRow","salesRep","customerName",
          "address","installDate","contractPrice","payment1","payment2","payment3",
          "payment4","balanceOwed","reviewedLabel","clearingNote")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT ("tenantId","region","sourcePeriod","sourceRow")
       DO UPDATE SET
         "salesRep" = EXCLUDED."salesRep",
         "customerName" = EXCLUDED."customerName",
         "address" = EXCLUDED."address",
         "installDate" = EXCLUDED."installDate",
         "contractPrice" = EXCLUDED."contractPrice",
         "payment1" = EXCLUDED."payment1",
         "payment2" = EXCLUDED."payment2",
         "payment3" = EXCLUDED."payment3",
         "payment4" = EXCLUDED."payment4",
         "balanceOwed" = EXCLUDED."balanceOwed",
         "reviewedLabel" = EXCLUDED."reviewedLabel",
         "clearingNote" = EXCLUDED."clearingNote"`,
      [
        TENANT_ID,
        region,
        period,
        p.sourceRow,
        p.salesRep,
        p.customerName,
        p.address,
        p.installDate,
        p.contractPrice,
        p.payment1,
        p.payment2,
        p.payment3,
        p.payment4,
        p.balanceOwed,
        meta.reviewedLabel,
        meta.clearingNote,
      ],
    );
    upserted++;
  }

  const total = await c.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM "InstallPayment"
     WHERE "tenantId" = $1 AND region = $2 AND "sourcePeriod" = $3`,
    [TENANT_ID, region, period],
  );

  await c.end();
  console.log(
    `Upserted ${upserted} rows. ${region}/${period} now holds ` +
      `${total.rows[0]?.count} InstallPayment rows.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
