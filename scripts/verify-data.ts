/**
 * Verify the slim generated.json matches what the source JSONL actually
 * contains. Re-derives the key metrics independently from the source
 * (without using the @vera/domain pipeline) and compares to what the
 * dashboard shows.
 *
 * Run: pnpm tsx scripts/verify-data.ts
 */
import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'data', 'jobs_dedup.jsonl');
const GENERATED = path.join(ROOT, 'apps', 'web', 'data', 'generated.json');

function row(label: string, source: string | number, generated: string | number) {
  const ok = String(source) === String(generated);
  const mark = ok ? '✓' : '✗';
  const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));
  console.log(`  ${mark} ${pad(label, 40)} source=${pad(String(source), 14)} dashboard=${generated}`);
  return ok;
}

function fmtUSD(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

async function main() {
  console.log('\n=== Data coherence check ===\n');

  // ---- Source-side counts ----
  let totalRecords = 0;
  let withInstall = 0;
  let withBalance = 0;
  let arSet = 0;
  let arBalance = 0;
  let excludeFromQB = 0;
  const repBalanceById = new Map<number, number>();
  const insuranceCount = { yes: 0, no: 0 };

  const stream = createReadStream(SOURCE, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    let rec: any;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    totalRecords += 1;
    if (rec.exclude_from_qb === true) excludeFromQB += 1;
    if (rec.date_completed) withInstall += 1;
    const balance = rec.primary_estimate?.balance ?? 0;
    if (balance > 0) withBalance += 1;
    if (rec.date_completed && balance > 0 && rec.exclude_from_qb !== true) {
      arSet += 1;
      arBalance += balance;
      const repId = rec.rep?.id;
      if (repId) repBalanceById.set(repId, (repBalanceById.get(repId) ?? 0) + balance);

      const sourceName = (rec.lead_source?.name ?? '').toLowerCase();
      const statusLabel = (rec.lead_status?.label ?? '').toLowerCase();
      const isInsurance =
        rec.insurance_claim != null && rec.insurance_claim !== false ||
        ['hail', 'storm', 'insurance', 'claim', 'adjuster'].some((h) => sourceName.includes(h)) ||
        ['claim filed', 'roof approved', 'roof denied', 'inspection - damage found'].some((h) =>
          statusLabel.includes(h),
        );
      if (isInsurance) insuranceCount.yes += 1;
      else insuranceCount.no += 1;
    }
  }

  // ---- Generated-side counts ----
  const fs = await import('node:fs/promises');
  const generated = JSON.parse(await fs.readFile(GENERATED, 'utf8'));
  const gen_jobCount = generated.jobs.length;
  const gen_totalAR = generated.totalAR;
  const gen_repCount = generated.reps.length;
  const gen_repBalances = new Map<number, number>(
    generated.reps.map((r: any) => [r.rep.id, r.totalOutstanding]),
  );
  const gen_critical = generated.jobs.filter((j: any) => j.heatBand === 'critical').length;
  const gen_hot = generated.jobs.filter((j: any) => j.heatBand === 'hot').length;
  const gen_warm = generated.jobs.filter((j: any) => j.heatBand === 'warm').length;
  const gen_cool = generated.jobs.filter((j: any) => j.heatBand === 'cool').length;
  const gen_fell = generated.jobs.filter((j: any) => j.fellThroughCracks).length;
  const gen_insurance = generated.jobs.filter((j: any) => j.isInsurance).length;
  const gen_retail = generated.jobs.filter((j: any) => !j.isInsurance).length;

  // ---- Compare ----
  console.log('Source funnel:');
  console.log(`  · ${totalRecords.toLocaleString()} total RoofLink records`);
  console.log(`  · ${withInstall.toLocaleString()} have date_completed (installed)`);
  console.log(`  · ${withBalance.toLocaleString()} have balance > 0`);
  console.log(`  · ${excludeFromQB.toLocaleString()} flagged exclude_from_qb (dropped)`);
  console.log(
    `  · ${arSet.toLocaleString()} pass the AR rule (installed + balance > 0 + not excluded)\n`,
  );

  console.log('Cross-checks (source vs dashboard):');
  let allMatch = true;
  allMatch = row('AR job count', arSet, gen_jobCount) && allMatch;
  allMatch =
    row('Total AR ($)', fmtUSD(arBalance), fmtUSD(gen_totalAR)) && allMatch;
  allMatch = row('Distinct reps with AR', repBalanceById.size, gen_repCount) && allMatch;
  allMatch =
    row('Insurance vs retail split', `${insuranceCount.yes}/${insuranceCount.no}`, `${gen_insurance}/${gen_retail}`) &&
    allMatch;

  console.log('\nDerived (dashboard) metrics — present in generated.json:');
  console.log(`  · Cool       ${gen_cool}`);
  console.log(`  · Warm       ${gen_warm}`);
  console.log(`  · Hot        ${gen_hot}`);
  console.log(`  · Critical   ${gen_critical}`);
  console.log(`  · Fell through cracks: ${gen_fell}`);
  console.log(`  · Heat band sum = ${gen_cool + gen_warm + gen_hot + gen_critical} (should equal AR job count = ${gen_jobCount})`);

  // ---- Top rep cross-check ----
  const topGenerated = generated.reps[0];
  let topSourceName = '?';
  let topSourceTotal = 0;
  let sourceWinnerId = -1;
  for (const [id, bal] of repBalanceById.entries()) {
    if (bal > topSourceTotal) {
      topSourceTotal = bal;
      sourceWinnerId = id;
    }
  }
  // Find name of the source winner from the generated rep list (their data flows from source).
  const matchingRep = generated.reps.find((r: any) => r.rep.id === sourceWinnerId);
  topSourceName = matchingRep?.rep.name ?? `rep#${sourceWinnerId}`;
  console.log('\nTop rep — source vs dashboard leaderboard #1:');
  row(
    `  ${topGenerated.rep.name}`,
    fmtUSD(topSourceTotal),
    fmtUSD(topGenerated.totalOutstanding),
  );

  console.log('');
  if (allMatch) {
    console.log('✓ All cross-checks match. Dashboard data is coherent with the source JSONL.');
  } else {
    console.log('✗ Mismatch detected. See ✗ rows above.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
