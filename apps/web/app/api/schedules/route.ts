import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { computeNextRun, type Cadence } from '@/lib/cadence';

export const runtime = 'nodejs';

/**
 * GET — list schedules for the signed-in user's tenant.
 * POST — create a schedule for the signed-in user's tenant.
 *
 * Auth: requires a signed-in session. The session callback in lib/auth.ts
 * stamps `tenantId` onto the session, so every read/write is tenant-scoped
 * and a tenant can never see another tenant's schedules.
 */

const ScheduleInputSchema = z.object({
  cadence: z.enum(['daily', 'weekly', 'monthly']),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.string().nullable().optional(),
  timeLocal: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1),
  recipient: z.string().email(),
  enabled: z.boolean().default(true),
});

/**
 * Belt-and-suspenders snap: round HH:mm to the nearest 15-min slot. The UI
 * already snaps on blur, but a misbehaving client (or a programmatic POST)
 * could send anything, and the cron worker only fires on the 15-min grid
 * — so a 02:10 schedule would actually fire at 02:15. We persist the
 * snapped value to keep the UI honest.
 */
function snapTo15Min(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const total = h * 60 + min;
  const snapped = Math.round(total / 15) * 15;
  const wrapped = snapped % (24 * 60);
  const sh = Math.floor(wrapped / 60);
  const sm = wrapped % 60;
  return `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
}

async function requireTenantId(): Promise<
  { ok: true; tenantId: number } | { ok: false; status: number; error: string }
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  const tenantId = session.user.tenantId;
  if (typeof tenantId !== 'number') {
    return { ok: false, status: 403, error: 'no_tenant_binding' };
  }
  return { ok: true, tenantId };
}

export async function GET() {
  const tenant = await requireTenantId();
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error }, { status: tenant.status });
  }
  const schedules = await db.schedule.findMany({
    where: { tenantId: tenant.tenantId },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json({ schedules });
}

export async function POST(req: Request) {
  const tenant = await requireTenantId();
  if (!tenant.ok) {
    return NextResponse.json({ error: tenant.error }, { status: tenant.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = ScheduleInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_error', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const tenantId = tenant.tenantId;
  const now = new Date();
  // Snap to the 15-min grid here too — the cron worker only polls every
  // 15 min so a non-grid time would fire late anyway.
  const timeLocal = snapTo15Min(parsed.data.timeLocal);
  const nextRunAt = computeNextRun({
    cadence: parsed.data.cadence as Cadence,
    timeLocal,
    timezone: parsed.data.timezone,
    dayOfWeek: parsed.data.dayOfWeek ?? null,
    dayOfMonth: parsed.data.dayOfMonth ?? null,
    fromDate: now,
  });

  const created = await db.schedule.create({
    data: {
      tenantId,
      cadence: parsed.data.cadence,
      dayOfWeek: parsed.data.dayOfWeek ?? null,
      dayOfMonth: parsed.data.dayOfMonth ?? null,
      timeLocal,
      timezone: parsed.data.timezone,
      recipient: parsed.data.recipient,
      enabled: parsed.data.enabled,
      nextRunAt,
    },
  });

  return NextResponse.json({ schedule: created }, { status: 201 });
}
