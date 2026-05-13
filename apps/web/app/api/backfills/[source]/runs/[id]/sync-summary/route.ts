import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isBackfillSource } from '@/lib/backfill/sources';
import { withAuth } from '@/lib/auth-helpers';
import { buildSyncSummaryData } from '@/lib/sync-summary-data';
import { renderSyncSummaryPDF } from '@/lib/sync-summary-pdf';

export const runtime = 'nodejs';

/**
 * GET /api/backfills/[source]/runs/[id]/sync-summary — returns the post-sync
 * PDF that the tick worker attaches to the success email.
 *
 * Doubles as ops tooling — operators can regenerate the report after the
 * email lands (or pull it for a run that finished before the PDF feature
 * shipped). The same `buildSyncSummaryData` / `renderSyncSummaryPDF` pair
 * powers both this route and `notifySuccess` in the tick worker.
 *
 * Tenant scope: the run must belong to the caller's tenant or the route
 * returns 404 (not 403, to avoid leaking existence).
 */

type RouteContext = { params: Promise<{ source: string; id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  return withAuth(async (audit) => {
    const { source: sourceRaw, id: idRaw } = await ctx.params;
    if (!isBackfillSource(sourceRaw)) {
      return NextResponse.json({ error: 'invalid_source' }, { status: 400 });
    }
    const runId = Number(idRaw);
    if (!Number.isInteger(runId) || runId <= 0) {
      return NextResponse.json({ error: 'invalid_run_id' }, { status: 400 });
    }

    const run = await db.backfillRun.findUnique({
      where: { id: runId },
      select: { tenantId: true, source: true, status: true, itemsProcessed: true },
    });
    if (!run || run.tenantId !== audit.tenantId || run.source !== sourceRaw) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (run.status !== 'completed') {
      return NextResponse.json(
        { error: 'not_ready', message: `status=${run.status}` },
        { status: 409 },
      );
    }

    const data = await buildSyncSummaryData(runId);
    if (!data || (data.jobRows.length === 0 && data.lineItemsRows.length === 0)) {
      return NextResponse.json({ error: 'no_records' }, { status: 204 });
    }

    const buffer = await renderSyncSummaryPDF(data);
    const filename = `vera-${run.source}-sync-run-${runId}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  });
}
