import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Playwright global setup. Runs once before the suite.
 *
 * - Wipes the `Briefing` table so spec assertions about State-A vs State-C
 *   are deterministic. Specs that want a briefing present should mock the
 *   regenerate API and click Fetch themselves; specs that want State A
 *   start clean.
 *
 * No-op if DATABASE_URL is unset (DB-less local runs of public-route specs).
 */
export default async function globalSetup(): Promise<void> {
  const dbUrl = resolveDatabaseUrl();
  if (!dbUrl) {
    // eslint-disable-next-line no-console
    console.warn('[playwright] DATABASE_URL not found — skipping DB reset');
    return;
  }

  try {
    // `pnpm --filter` cd's into apps/web, so the schema path is relative to
    // that workspace.
    execSync(
      `pnpm --filter @vera/web exec prisma db execute --schema prisma/schema.prisma --stdin`,
      {
        input: 'DELETE FROM "Briefing";\n',
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: ['pipe', 'ignore', 'inherit'],
      },
    );
    // eslint-disable-next-line no-console
    console.log('[playwright] cleared Briefing table');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[playwright] DB reset failed — specs may be non-deterministic:', e);
  }
}

function resolveDatabaseUrl(): string | null {
  if (process.env.DATABASE_URL) return stripQuotes(process.env.DATABASE_URL);
  const envPath = join(process.cwd(), 'apps/web/.env.local');
  if (!existsSync(envPath)) return null;
  const env = readFileSync(envPath, 'utf8');
  const m = env.match(/^DATABASE_URL=(.+)$/m);
  return m ? stripQuotes(m[1].trim()) : null;
}

function stripQuotes(s: string): string {
  return s.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}
