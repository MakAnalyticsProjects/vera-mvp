import 'server-only';

/**
 * Cadence math — given a schedule's local time + cadence rule, compute the
 * next UTC instant at which it should fire after a given clock.
 *
 * Pure function, easy to unit test. Handles DST transitions correctly by
 * using Intl.DateTimeFormat to interpret the local wall-clock time inside the
 * tenant's timezone.
 *
 * Usage:
 *   const nextRunAt = computeNextRun({
 *     cadence: 'daily',
 *     timeLocal: '08:00',
 *     timezone: 'America/Chicago',
 *     fromDate: new Date(),
 *   });
 */

export type Cadence = 'daily' | 'weekly' | 'monthly';

export interface ComputeNextRunInput {
  cadence: Cadence;
  /** "HH:mm" in the tenant's local timezone. */
  timeLocal: string;
  /** IANA tz, e.g. "America/Chicago". */
  timezone: string;
  /** 0 (Sunday) .. 6 (Saturday). Required for weekly cadence. */
  dayOfWeek?: number | null;
  /** "1".."28" or "last" or "last-business". Required for monthly cadence. */
  dayOfMonth?: string | null;
  /** The clock to compute "next after" from. */
  fromDate: Date;
}

/**
 * Returns the UTC `Date` at which the schedule should next fire.
 */
export function computeNextRun(input: ComputeNextRunInput): Date {
  const { cadence, timeLocal, timezone, dayOfWeek, dayOfMonth, fromDate } = input;
  const parts = timeLocal.split(':');
  const h = parts[0] !== undefined ? Number(parts[0]) : NaN;
  const m = parts[1] !== undefined ? Number(parts[1]) : NaN;
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid timeLocal: ${timeLocal}`);
  }

  // Walk forward in the tenant's timezone calendar one day/week/month at a
  // time, building candidate firings. Stop when a candidate is in the future.
  // For most schedules this is at most a small number of iterations.
  let cursor = new Date(fromDate.getTime());
  const maxIterations = cadence === 'monthly' ? 60 : cadence === 'weekly' ? 14 : 7;

  for (let i = 0; i < maxIterations; i++) {
    const candidate = candidateAt(cursor, h, m, timezone, cadence, dayOfWeek, dayOfMonth);
    if (candidate && candidate.getTime() > fromDate.getTime()) {
      return candidate;
    }
    cursor = addDays(cursor, 1);
  }

  // Should never happen for sensible inputs.
  throw new Error(
    `Could not compute nextRunAt for cadence=${cadence} timeLocal=${timeLocal} timezone=${timezone}`,
  );
}

function candidateAt(
  date: Date,
  hour: number,
  minute: number,
  timezone: string,
  cadence: Cadence,
  dayOfWeek?: number | null,
  dayOfMonth?: string | null,
): Date | null {
  const local = toLocal(date, timezone);

  if (cadence === 'weekly') {
    if (typeof dayOfWeek !== 'number') return null;
    if (local.weekday !== dayOfWeek) return null;
  }

  if (cadence === 'monthly') {
    if (!dayOfMonth) return null;
    const monthDay = resolveMonthDay(dayOfMonth, local.year, local.month);
    if (monthDay !== local.day) return null;
  }

  // Build a UTC instant that, when formatted in `timezone`, reads as
  // year-month-day at hour:minute. Iteratively correct for DST offset.
  return zonedTimeToUtc(local.year, local.month, local.day, hour, minute, timezone);
}

interface LocalParts {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number;
  minute: number;
  /** 0 (Sunday) .. 6 (Saturday). */
  weekday: number;
}

function toLocal(date: Date, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    weekday: weekdayMap[get('weekday')] ?? 0,
  };
}

/**
 * Build a UTC Date for the given local wall-clock time in `timezone`. Works
 * by guessing UTC, comparing against the formatter, and correcting for the
 * tz offset including DST. Two iterations are enough for any timezone.
 */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // Initial guess: treat the local parts as if they were UTC.
  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0));

  for (let i = 0; i < 2; i++) {
    const local = toLocal(utc, timezone);
    const drift =
      (local.hour - hour) * 60 + (local.minute - minute) + (local.day - day) * 24 * 60;
    if (drift === 0) return utc;
    utc = new Date(utc.getTime() - drift * 60 * 1000);
  }
  return utc;
}

function resolveMonthDay(spec: string, year: number, month: number): number {
  if (spec === 'last') return lastDayOfMonth(year, month);
  if (spec === 'last-business') {
    let d = lastDayOfMonth(year, month);
    while (true) {
      const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
      if (dow !== 0 && dow !== 6) return d;
      d -= 1;
    }
  }
  const n = parseInt(spec, 10);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid dayOfMonth spec: ${spec}`);
  }
  return n;
}

function lastDayOfMonth(year: number, month: number): number {
  // month is 1..12; passing day 0 of next month gives last day of current.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000);
}
