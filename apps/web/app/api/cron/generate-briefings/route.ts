import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateBriefingForTenant } from '@/lib/briefing-generator';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Cron endpoint, triggered daily at 7am Central by the
 * `cron-generate-briefings.yml` GitHub Actions workflow with
 * `Authorization: Bearer $CRON_SECRET`.
 *
 * For each tenant, generates a fresh AI briefing and writes it to the
 * `Briefing` table. Errors per-tenant are caught so one failure doesn't
 * starve the others.
 */

export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 },
    );
  }
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const tenants = await db.tenant.findMany();
  const results: Array<{
    tenantId: number;
    status: 'ok' | 'failed';
    briefingId?: number;
    error?: string;
  }> = [];

  for (const t of tenants) {
    try {
      const r = await generateBriefingForTenant(t.id);
      results.push({
        tenantId: t.id,
        status: 'ok',
        briefingId: r.briefingId,
      });
    } catch (e) {
      results.push({
        tenantId: t.id,
        status: 'failed',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    generated: results.filter((r) => r.status === 'ok').length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
    at: new Date().toISOString(),
  });
}
