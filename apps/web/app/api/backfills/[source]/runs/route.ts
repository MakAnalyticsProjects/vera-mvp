import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isBackfillSource } from '@/lib/backfill/sources';
import { publishNextTick } from '@/lib/backfill/qstash';
import { withAuth } from '@/lib/auth-helpers';
import { recordAudit } from '@/lib/audit';

export const runtime = 'nodejs';

/**
 * POST /api/backfills/[source]/runs — kick off a new run (Run-now path).
 *
 * Refuses (409) if a run is already in flight for this source. The cancel
 * endpoint must be used to terminate the existing run first.
 *
 * Audit: emits `backfill.run_started` with the chosen mode (full vs
 * incremental) when the run is created.
 */

const SOURCE_LABEL: Record<string, string> = {
  rooflink_jobs: 'Rooflink jobs',
  rooflink_lineitems: 'Rooflink estimate line items',
};
function sourceLabel(source: string): string {
  return SOURCE_LABEL[source] ?? source;
}

type RouteContext = { params: Promise<{ source: string }> };

export async function POST(req: Request, ctx: RouteContext) {
  return withAuth(async (audit) => {
    const { source: sourceRaw } = await ctx.params;
    if (!isBackfillSource(sourceRaw)) {
      return NextResponse.json({ error: 'invalid_source' }, { status: 400 });
    }
    const source = sourceRaw;
    const { tenantId } = audit;

    // Refuse if a queued/running run already exists for this source.
    const inflight = await db.backfillRun.findFirst({
      where: {
        tenantId,
        source,
        status: { in: ['queued', 'running'] },
      },
      orderBy: { id: 'desc' },
    });
    if (inflight) {
      return NextResponse.json(
        {
          error: 'already_running',
          message:
            'A run for this source is already in progress. Cancel it before starting a new one.',
          runId: inflight.id,
        },
        { status: 409 },
      );
    }

    // Decide mode. The watermark is the `startedAt` of the most recent
    // successfully completed run for this (tenant, source) — derived from
    // BackfillRun directly so Run-now works even when no BackfillSchedule
    // row exists (the common case before a cron is configured). The schedule's
    // `lastSyncedAt` is a denormalized cache the dispatcher uses; we don't
    // depend on it here. `?mode=full` forces a full re-sync (the "Run as
    // full sync" UI affordance, used for periodic schema/deletion refresh).
    const url = new URL(req.url);
    const forceFull = url.searchParams.get('mode') === 'full';

    let watermark: Date | null = null;
    if (!forceFull) {
      const lastCompleted = await db.backfillRun.findFirst({
        where: {
          tenantId,
          source,
          status: 'completed',
          startedAt: { not: null },
        },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      });
      watermark = lastCompleted?.startedAt ?? null;
    }

    const schedule = await db.backfillSchedule.findUnique({
      where: { tenantId_source: { tenantId, source } },
    });
    const mode: 'full' | 'incremental' = watermark ? 'incremental' : 'full';

    const run = await db.backfillRun.create({
      data: {
        tenantId,
        source,
        status: 'running',
        mode,
        syncedSince: watermark,
        scheduleId: schedule?.id ?? null,
        startedAt: new Date(),
      },
    });

    // Kick off the first tick. Build the absolute URL the chained ticks will
    // POST to — we pass it through so QStash (or the dev fallback) targets
    // the correct env (localhost in dev, the Vercel function URL in prod).
    const origin = new URL(req.url).origin;
    const destinationUrl = `${origin}/api/cron/backfill-tick`;
    await publishNextTick({ runId: run.id, destinationUrl, delaySec: 0 });

    await recordAudit(db, {
      tenantId,
      userId: audit.userId,
      userEmail: audit.userEmail,
      category: 'backfill',
      action: 'run_started',
      entityType: 'BackfillRun',
      entityId: String(run.id),
      summary: `${sourceLabel(source)} ${mode} backfill started`,
      details: {
        source,
        mode,
        runId: run.id,
        syncedSince: watermark?.toISOString() ?? null,
        scheduleId: schedule?.id ?? null,
        trigger: 'manual',
      },
    });

    return NextResponse.json({ run }, { status: 201 });
  });
}
