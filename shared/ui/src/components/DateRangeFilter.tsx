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

const chipBase =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors';
const chipOn = 'bg-accent border-transparent text-white';
const chipOff =
  'border-border text-text-secondary hover:border-accent/40 hover:bg-bg-base hover:text-text-primary';

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

      <Popover open={open} onOpenChange={setOpen}>
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
            selected={selectedRange}
            defaultMonth={selectedRange?.from}
            onSelect={(range?: DateRange) => {
              if (!range?.from) {
                onChange({ preset: 'all' });
                return;
              }
              onChange({
                preset: 'custom',
                from: format(range.from, ISO),
                to: range.to ? format(range.to, ISO) : format(range.from, ISO),
              });
              // Close once both ends are chosen; keep open after the first click
              // so the user can pick the end date.
              if (range.to) setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
