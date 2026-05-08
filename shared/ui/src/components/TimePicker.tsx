'use client';

/**
 * TimePicker — plain native `<input type="time">`.
 *
 * The OS calendar-picker indicator (clock glyph that opens the system picker)
 * is hidden via the WebKit pseudo-element so the field renders as a clean
 * text-style input. Value is "HH:mm" (24-hour) — same contract the consumer
 * had with the previous Select-based component, so SchedulerView and friends
 * keep working unchanged.
 *
 * 15-minute snapping is enforced at TWO layers:
 *   1. Native `step` (15 min) so the spinner / arrow keys jump in 15-min
 *      increments and the browser shows a "must be on the grid" hint when
 *      the user submits a form with a non-conforming value.
 *   2. `onBlur` rounds the value to the nearest grid tick. Snap is NOT done
 *      on every keystroke — that fights the browser's internal hour/minute
 *      field editing and makes typing impossible.
 *
 * Consumers should also enforce the grid server-side on submit (the API
 * does this, see /api/schedules/route.ts).
 *
 * Override `stepMinutes` for non-15-min granularity (5 / 30 / etc).
 */
export function TimePicker({
  value,
  onChange,
  className,
  ariaLabel,
  stepMinutes = 15,
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  ariaLabel?: string;
  stepMinutes?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="time"
      aria-label={ariaLabel ?? 'Time'}
      value={value}
      disabled={disabled}
      // Pass-through during typing so the user can edit freely.
      onChange={(e) => onChange(e.target.value)}
      // Snap when the user is done editing. Idempotent — already-snapped
      // values stay unchanged.
      onBlur={(e) => {
        const snapped = snapToStep(e.target.value, stepMinutes);
        if (snapped !== e.target.value) onChange(snapped);
      }}
      step={stepMinutes * 60}
      className={
        'border-border bg-bg-card text-text-primary focus:border-accent w-full appearance-none rounded-xl border px-4 py-2.5 text-sm outline-none transition-colors tabular-nums disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none ' +
        (className ?? '')
      }
    />
  );
}

/**
 * Round an HH:mm string to the nearest multiple of `stepMinutes`. Returns
 * the original string if it's not a parseable time (e.g. partial input).
 */
export function snapToStep(hhmm: string, stepMinutes: number): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return hhmm;
  const total = h * 60 + min;
  const snapped = Math.round(total / stepMinutes) * stepMinutes;
  // Wrap around at 24:00 → 00:00 to avoid emitting "24:00".
  const wrapped = snapped % (24 * 60);
  const sh = Math.floor(wrapped / 60);
  const sm = wrapped % 60;
  return `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
}
