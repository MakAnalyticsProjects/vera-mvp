'use client';

import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Filter, Search, X } from 'lucide-react';
import { cn } from '../lib/cn';

const useIsoLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterGroup {
  key: string;
  label: string;
  options: FilterOption[];
  /** chips: render each option as a pill (good for ≤8 options).
   *  dropdown: render a searchable dropdown with checkboxes (good for long lists). */
  type?: 'chips' | 'dropdown';
  /** Placeholder text inside a dropdown's search input. */
  searchPlaceholder?: string;
}

export interface FilterMenuProps {
  groups: FilterGroup[];
  selected: Record<string, string[]>;
  onSelectedChange: (next: Record<string, string[]>) => void;
  triggerLabel?: string;
}

export function FilterMenu({
  groups,
  selected,
  onSelectedChange,
  triggerLabel = 'Filter',
}: FilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(
    null,
  );
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const id = useId();

  useEffect(() => setMounted(true), []);

  useIsoLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const update = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (wrapRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      // Any portaled descendant popover (e.g. the rep dropdown) is marked with
      // [data-filter-popover]. Treat clicks inside those as inside the filter.
      if (target.closest?.('[data-filter-popover]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const totalSelected = useMemo(
    () => Object.values(selected).reduce((sum, vals) => sum + (vals?.length ?? 0), 0),
    [selected],
  );

  function toggle(groupKey: string, value: string) {
    const current = selected[groupKey] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onSelectedChange({ ...selected, [groupKey]: next });
  }

  function clearAll() {
    const cleared: Record<string, string[]> = {};
    for (const g of groups) cleared[g.key] = [];
    onSelectedChange(cleared);
  }

  const popover =
    open && mounted && position
      ? createPortal(
          <div
            ref={popoverRef}
            id={id}
            role="dialog"
            data-filter-popover
            style={{
              position: 'fixed',
              top: position.top,
              right: position.right,
            }}
            className="bg-bg-card border-border z-[200] max-h-[80vh] w-[360px] overflow-y-auto rounded-2xl border shadow-2xl"
          >
            <div className="border-border bg-bg-subtle/60 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur">
              <p className="font-display text-sm font-medium tracking-tight">Filters</p>
              <button
                type="button"
                onClick={clearAll}
                disabled={totalSelected === 0}
                className="text-accent text-xs disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-5 px-4 py-4">
              {groups.map((g) => {
                const sel = selected[g.key] ?? [];
                if (g.type === 'dropdown') {
                  return (
                    <DropdownGroup
                      key={g.key}
                      group={g}
                      selected={sel}
                      onToggle={(v) => toggle(g.key, v)}
                    />
                  );
                }
                return (
                  <ChipGroup
                    key={g.key}
                    group={g}
                    selected={sel}
                    onToggle={(v) => toggle(g.key, v)}
                  />
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className={cn(
          'border-border text-text-secondary hover:bg-bg-base hover:text-text-primary inline-flex h-9 items-center gap-2 rounded-full border bg-transparent px-3.5 text-sm font-medium transition-colors',
          totalSelected > 0 && 'border-accent text-accent hover:text-accent',
        )}
      >
        <Filter className="h-3.5 w-3.5" />
        {triggerLabel}
        {totalSelected > 0 ? (
          <span className="bg-accent ml-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[0.65rem] font-semibold text-white tabular-nums">
            {totalSelected}
          </span>
        ) : null}
      </button>
      {popover}
    </div>
  );
}

function ChipGroup({
  group,
  selected,
  onToggle,
}: {
  group: FilterGroup;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-text-muted mb-2 text-[0.65rem] font-semibold tracking-[0.18em] uppercase">
        {group.label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {group.options.map((opt) => {
          const isOn = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                isOn
                  ? 'bg-accent border-transparent text-white'
                  : 'border-border text-text-secondary hover:border-accent/40 hover:bg-bg-base',
              )}
            >
              <span>{opt.label}</span>
              {typeof opt.count === 'number' ? (
                <span
                  className={cn(
                    'tabular-nums',
                    isOn ? 'text-white/80' : 'text-text-muted',
                  )}
                >
                  {opt.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DropdownGroup({
  group,
  selected,
  onToggle,
}: {
  group: FilterGroup;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  useIsoLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return group.options;
    return group.options.filter((o) => o.label.toLowerCase().includes(q));
  }, [group.options, search]);

  const triggerLabel =
    selected.length === 0
      ? group.options.length === 0
        ? 'No options'
        : 'Select…'
      : selected.length === 1
        ? group.options.find((o) => o.value === selected[0])?.label ?? '1 selected'
        : `${selected.length} selected`;

  const popover =
    open && mounted && position
      ? createPortal(
          <div
            ref={popoverRef}
            data-filter-popover
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              width: position.width,
            }}
            className="bg-bg-card border-border z-[210] max-h-[260px] overflow-hidden rounded-xl border shadow-xl"
          >
            <div className="border-border border-b p-2">
              <label className="border-border focus-within:border-accent flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
                <Search className="text-text-muted h-3 w-3 shrink-0" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    group.searchPlaceholder ?? `Search ${group.label.toLowerCase()}…`
                  }
                  className="text-text-primary placeholder:text-text-muted w-full bg-transparent text-xs outline-none"
                  autoFocus
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="text-text-muted hover:text-text-primary"
                    aria-label="Clear search"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </label>
            </div>
            <div className="max-h-[200px] overflow-y-auto py-1">
              {visible.length === 0 ? (
                <p className="text-text-muted px-3 py-3 text-xs">No matches.</p>
              ) : (
                visible.map((opt) => {
                  const isOn = selected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggle(opt.value)}
                      className={cn(
                        'hover:bg-bg-base flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition-colors',
                        isOn && 'bg-accent/5',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            isOn
                              ? 'bg-accent border-accent text-white'
                              : 'border-border bg-bg-card',
                          )}
                        >
                          {isOn ? <Check className="h-3 w-3" /> : null}
                        </span>
                        <span className="text-text-primary">{opt.label}</span>
                      </span>
                      {typeof opt.count === 'number' ? (
                        <span className="text-text-muted tabular-nums">{opt.count}</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div>
      <p className="text-text-muted mb-2 text-[0.65rem] font-semibold tracking-[0.18em] uppercase">
        {group.label}
      </p>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'border-border text-text-primary hover:border-accent/40 hover:bg-bg-base flex w-full items-center justify-between rounded-xl border bg-transparent px-3 py-2 text-sm transition-colors',
          selected.length > 0 && 'border-accent/60',
        )}
      >
        <span className={cn('truncate', selected.length === 0 && 'text-text-muted')}>
          {triggerLabel}
        </span>
        <ChevronDown className="text-text-muted h-3.5 w-3.5 shrink-0" />
      </button>
      {popover}
    </div>
  );
}

export interface TableToolbarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function TableToolbar({ title, subtitle, children, className }: TableToolbarProps) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-3', className)}>
      <div>
        {title ? (
          <h2 className="text-text-secondary text-sm tracking-[0.2em] uppercase">{title}</h2>
        ) : null}
        {subtitle ? <p className="text-text-muted mt-1 text-xs">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
