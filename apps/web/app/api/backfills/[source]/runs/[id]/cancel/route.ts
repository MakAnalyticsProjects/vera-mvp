import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isBackfillSource } from '@/lib/backfill/sources';
import { withAuth } from '@/lib/auth-helpers';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * POST /api/backfills/[source]/runs/[id]/cancel — cancel an in-flight run.
 *
 * Per docs/BACKFILL_SCHEDULING.md §8 — hard delete the partial rows so
 * storage doesn't accumulate canceled-version garbage. The next tick that
 * wakes up sees status != 'running' and exits without doing work.
 *
 * Audit: emits `backfill.run_cancelled` after a successful state flip.
 */

const SOURCE_LABEL: Record<string, string> = {
  rooflink_jobs: 'Rooflink jobs',
  rooflink_lineitems: 'Rooflink estimate line items',
};
function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

type RouteContext = { params: Promise<{ source: string; id: string }> };

export async function POST(_req: Request, ctx: RouteContext) {
  return withAuth(async (audit) => {
    const { source: sourceRaw, id: idRaw } = await ctx.params;
    if (!isBackfillSource(sourceRaw)) {
      return NextResponse.json({ error: 'invalid_source' }, { status: 400 });
    }
    const runId = Number(idRaw);
    if (!Number.isInteger(runId) || runId <= 0) {
      return NextResponse.json({ error: 'invalid_run_id' }, { status: 400 });
    }

    const run = await db.backfillRun.findUnique({ where: { id: runId } });
    if (!run || run.tenantId !== audit.tenantId || run.source !== sourceRaw) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (run.status !== 'running' && run.status !== 'queued') {
      return NextResponse.json(
        { error: 'not_cancelable', message: `status=${run.status}` },
        { status: 409 },
      );
    }

    await db.$transaction([
      // Hard delete partial rows tagged with this dataVersion.
      db.rawRooflinkJob.deleteMany({ where: { dataVersion: runId } }),
      db.rawRooflinkLineItems.deleteMany({ where: { dataVersion: runId } }),
      db.backfillRun.update({
        where: { id: runId },
        data: {
          status: 'canceled',
          finishedAt: new Date(),
          claimedAt: null,
        },
      }),
    ]);

    await recordAudit(db, {
      tenantId: audit.tenantId,
      userId: audit.userId,
      userEmail: audit.userEmail,
      category: 'backfill',
      action: 'run_cancelled',
      entityType: 'BackfillRun',
      entityId: String(runId),
      summary: `${sourceLabel(sourceRaw)} backfill run #${runId} cancelled`,
      details: {
        source: sourceRaw,
        runId,
        mode: run.mode,
        itemsProcessed: run.itemsProcessed,
        startedAt: run.startedAt?.toISOString() ?? null,
      },
    });

    return NextResponse.json({ canceled: true, runId });
  });
}
