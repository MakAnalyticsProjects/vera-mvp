'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface TablePaginationProps {
  total: number;
  page: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  className?: string;
  /** When true, renders without footer chrome (use as a stand-alone block). */
  standalone?: boolean;
}

export function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
  standalone = false,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, total);
  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  const pages: Array<number | 'gap'> = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i += 1) pages.push(i);
  } else {
    pages.push(1);
    if (safePage > 3) pages.push('gap');
    const lo = Math.max(2, safePage - 1);
    const hi = Math.min(totalPages - 1, safePage + 1);
    for (let i = lo; i <= hi; i += 1) pages.push(i);
    if (safePage < totalPages - 2) pages.push('gap');
    pages.push(totalPages);
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs',
        standalone ? '' : 'bg-bg-subtle/40 border-border border-t',
        className,
      )}
    >
      <div className="text-text-muted flex flex-wrap items-center gap-x-4 gap-y-2">
        <PageSizeDropdown value={pageSize} onChange={onPageSizeChange} />
        <span className="hidden sm:inline">
          Showing <span className="text-text-primary tabular-nums">{startIndex}</span>–
          <span className="text-text-primary tabular-nums">{endIndex}</span> of{' '}
          <span className="text-text-primary tabular-nums">{total}</span>
        </span>
      </div>

      {/* Mobile: arrow Prev/Next + "page x of y" text. Saves a row vs the
          desktop layout which shows the full page-number list. */}
      <div className="flex items-center gap-1.5 sm:hidden">
        <button
          type="button"
          onClick={() => canPrev && onPageChange(safePage - 1)}
          disabled={!canPrev}
          className="border-border bg-bg-card text-text-secondary hover:bg-bg-base hover:text-text-primary inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-text-secondary tabular-nums">
          <span className="text-text-primary">{safePage}</span> of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => canNext && onPageChange(safePage + 1)}
          disabled={!canNext}
          className="border-border bg-bg-card text-text-secondary hover:bg-bg-base hover:text-text-primary inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Desktop: full page-number list. */}
      <div className="hidden flex-wrap items-center justify-end gap-1 sm:flex">
        <button
          type="button"
          onClick={() => canPrev && onPageChange(safePage - 1)}
          disabled={!canPrev}
          className="border-border bg-bg-card text-text-secondary hover:bg-bg-base hover:text-text-primary inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        {pages.map((p, idx) =>
          p === 'gap' ? (
            <span key={`gap-${idx}`} className="text-text-muted px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                'inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 tabular-nums transition-colors',
                p === safePage
                  ? 'bg-accent text-white'
                  : 'border-border bg-bg-card text-text-secondary hover:bg-bg-base hover:text-text-primary border',
              )}
              aria-current={p === safePage ? 'page' : undefined}
              aria-label={`Page ${p}`}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => canNext && onPageChange(safePage + 1)}
          disabled={!canNext}
          className="border-border bg-bg-card text-text-secondary hover:bg-bg-base hover:text-text-primary inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function PageSizeDropdown({
  value,
  onChange,
}: {
  value: PageSize;
  onChange: (next: PageSize) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="border-border bg-bg-card text-text-primary hover:bg-bg-base inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors"
        aria-label="Rows per page"
      >
        <span className="text-text-muted">Rows per page</span>
        <span className="font-semibold tabular-nums">{value}</span>
        <ChevronDown className="text-text-muted h-3 w-3" />
      </button>
      {open ? (
        <div
          role="listbox"
          className="bg-bg-card border-border absolute bottom-full left-0 z-30 mb-1 w-[140px] overflow-hidden rounded-xl border shadow-xl"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <button
              key={size}
              type="button"
              role="option"
              aria-selected={size === value}
              onClick={() => {
                onChange(size);
                setOpen(false);
              }}
              className={cn(
                'hover:bg-bg-base block w-full px-3 py-2 text-left text-xs transition-colors',
                size === value && 'text-accent font-semibold',
              )}
            >
              {size} per page
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
