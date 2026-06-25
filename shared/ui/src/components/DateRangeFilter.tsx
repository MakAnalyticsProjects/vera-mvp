'use client';

import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import {
  endOfMonth,
  format,
  isValid,
  parse,
  startOfMonth,
  subMonths,
} from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { Calendar } from './Calendar';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';
import { cn } from '../lib/cn';

/**
 * DateRangeFilter — preset chips (All / This month / Last 3 months) plus a
 * custom range picked from a two-month Calendar. Filters on a date column.
 *
 * The component is presentational: it emits a DateRangeValue. Consumers resolve
 * the preset to a concrete window with `resolveDateRange(value, now)` and do the
 * actual filtering. Presets are stored as intent (not frozen dates) so "This
 * month" keeps meaning the current month after time passes or when a URL is
 * shared — the window is recomputed from `now` at render.
 */

export type DateRangePreset = 'all' | 'month' | 'last3' | 'custom';

export interface DateRangeValue {
  preset: DateRangePreset;
  /** yyyy-MM-dd, present only when preset === 'custom'. */
  from?: string;
  to?: string;
}

const ISO = 'yyyy-MM-dd';

function parseIso(s: string): Date | undefined {
  const d = parse(s, ISO, new Date());
  return isValid(d) ? d : undefined;
}

function fmtShort(s: string): string {
  const d = parseIso(s);
  return d ? format(d, 'MMM d') : s;
}

/**
 * Resolve a DateRangeValue to a concrete [from, to] window in yyyy-MM-dd.
 * `now` is passed in (browser-local) — never read the clock inside. A null
 * bound means "open-ended" on that side.
 */
export function resolveDateRange(
  value: DateRangeValue,
  now: Date,
): { from: string | null; to: string | null } {
  switch (value.preset) {
    case 'month':
      return { from: format(startOfMonth(now), ISO), to: format(endOfMonth(now), ISO) };
    case 'last3':
      return {
        from: format(startOfMonth(subMonths(now, 2)), ISO),
        to: format(endOfMonth(now), ISO),
      };
    case 'custom':
      return { from: value.from ?? null, to: value.to ?? null };
    case 'all':
    default:
      return { from: null, to: null };
  }
}

const PRESETS: { key: Exclude<DateRangePreset, 'custom'>; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'month', label: 'This month' },
  { key: 'last3', label: 'Last 3 months' },
];

// NOTE: these pills duplicate the active/inactive pill style of the Rep
// Leaderboard's local `Chip` (apps/web/.../rep-leaderboard/RepLeaderboardView.tsx).
// Kept in sync by hand for now; unify into a shared @vera/ui <Pill> primitive
// later so the two surfaces can't drift.
const chipBase =
  'inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors';
const chipOn =
  'bg-accent border-transparent text-white shadow-[0_2px_6px_-2px_rgba(200,133,78,0.4)]';
const chipOff =
  'border-border text-text-secondary hover:border-accent/40 hover:bg-bg-base hover:text-text-primary';

/**
 * Range-mode calendar styling. The shared Calendar colours the selected *button*
 * (rounded), which in a range shows a notch between every adjacent day. To get
 * the seamless shadcn bar we instead paint a continuous light track on the day
 * *cells* (they touch edge-to-edge) and reserve solid rounded pills for the two
 * endpoints. Only the palette differs from shadcn. Single-select usages of
 * Calendar are untouched — these overrides apply only here.
 */
const RANGE_CLASS_NAMES = {
  // first:/last: round the row-wrap ends of the track (Sunday left, Saturday
  // right) so each week's segment reads as a rounded bar, matching shadcn. The
  // rounding is a no-op on cells with no track background.
  day: 'relative h-9 w-9 p-0 text-center text-sm first:rounded-l-md last:rounded-r-md',
  day_button: cn(
    'h-9 w-9 rounded-md p-0 font-normal text-text-primary transition-colors',
    'hover:bg-bg-base/70',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  ),
  // Neutralise the shared single-select rule; range colour comes from the
  // start / middle / end modifiers below. The continuous light track is painted
  // directly on each range cell (start/middle/end) — not via `:has([aria-selected])`,
  // because react-day-picker v9 doesn't mark the in-between days aria-selected, so
  // a `:has()` track would leave the middle cells blank. The cells touch edge to
  // edge, so a shared `bg-accent/15` on all three reads as one seamless bar; only
  // the two endpoints round their outer edge and carry the solid accent pill.
  selected: '',
  range_start: cn(
    'rounded-l-md bg-accent/15',
    '[&>button]:rounded-md [&>button]:bg-accent [&>button]:text-white [&>button]:hover:bg-accent',
  ),
  range_end: cn(
    'rounded-r-md bg-accent/15',
    '[&>button]:rounded-md [&>button]:bg-accent [&>button]:text-white [&>button]:hover:bg-accent',
  ),
  range_middle: cn(
    'bg-accent/15',
    '[&>button]:rounded-none [&>button]:bg-transparent [&>button]:text-text-primary [&>button]:hover:bg-accent/25',
  ),
};

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedRange: DateRange | undefined =
    value.preset === 'custom' && value.from
      ? { from: parseIso(value.from), to: value.to ? parseIso(value.to) : undefined }
      : undefined;

  // Draft range the Calendar drives directly while the popover is open. Keeping
  // it local lets react-day-picker hold the intermediate {from, to:undefined}
  // state between the two clicks of a range — we only propagate to the parent
  // (and close) once BOTH ends are chosen. Seeded from the committed value each
  // time the popover opens so a re-open shows the current selection.
  const [draft, setDraft] = useState<DateRange | undefined>(selectedRange);

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(selectedRange);
    setOpen(next);
  };

  const customLabel =
    value.preset === 'custom' && value.from
      ? `${fmtShort(value.from)} – ${value.to ? fmtShort(value.to) : '…'}`
      : 'Custom range';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((p) => {
        const isOn = value.preset === p.key;
        return (
          <button
            key={p.key}
            type="button"
            data-preset={p.key}
            aria-pressed={isOn}
            onClick={() => onChange({ preset: p.key })}
            className={cn(chipBase, isOn ? chipOn : chipOff)}
          >
            {p.label}
          </button>
        );
      })}

      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-preset="custom"
            aria-pressed={value.preset === 'custom'}
            className={cn(chipBase, value.preset === 'custom' ? chipOn : chipOff)}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            {customLabel}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-0">
          <Calendar
            mode="range"
            numberOfMonths={2}
            selected={draft}
            defaultMonth={draft?.from}
            classNames={RANGE_CLASS_NAMES}
            onSelect={(range?: DateRange) => {
              // The Calendar owns selection; we never auto-close (matches the
              // shadcn date-range picker). The popover stays open across both
              // clicks so the user can always pick a start then an end, and can
              // re-adjust either end before dismissing by clicking away. We only
              // push to the parent filter once a full range exists.
              setDraft(range);
              if (range?.from && range.to) {
                onChange({
                  preset: 'custom',
                  from: format(range.from, ISO),
                  to: format(range.to, ISO),
                });
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
