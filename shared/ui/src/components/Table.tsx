import * as React from 'react';
import { cn } from '../lib/cn';
import { Tooltip } from './Tooltip';

/**
 * Vera table — opinionated wrapper that gives every table the same
 * warm-card chrome, sticky header with shadow on scroll, and clear
 * visual separation between header and body rows.
 */
export interface TableShellProps {
  className?: string;
  /**
   * Explicit maxHeight in pixels. When omitted, a responsive default is used:
   * 480px on `<sm` and 640px from `sm` up. Pass a number to override.
   */
  maxHeight?: number;
  children: React.ReactNode;
  /** Optional footer slot — typically a TablePagination strip. Renders inside the same card chrome with a top border. */
  footer?: React.ReactNode;
}

export function TableShell({ className, maxHeight, children, footer }: TableShellProps) {
  const useResponsive = maxHeight === undefined;
  return (
    <div
      className={cn(
        'border-border bg-bg-card overflow-hidden rounded-[var(--radius-card)] border shadow-[0_2px_4px_-2px_rgba(31,27,22,0.04),0_4px_12px_-4px_rgba(31,27,22,0.05)]',
        className,
      )}
    >
      {/* overflow-x-auto wraps the y-scroll container so wide tables get a
          horizontal scroll handle on mobile instead of clipping content. */}
      <div className="overflow-x-auto">
        <div
          className={cn(
            'overflow-y-auto',
            useResponsive && 'max-h-[480px] sm:max-h-[640px]',
          )}
          style={useResponsive ? undefined : { maxHeight }}
        >
          {children}
        </div>
      </div>
      {footer ? <div className="bg-bg-subtle/40 border-border border-t">{footer}</div> : null}
    </div>
  );
}

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    // min-w-[720px] keeps columns readable on mobile by triggering horizontal
    // scroll inside TableShell instead of squishing every column to ~50px.
    // On desktop the container is wider than 720, so w-full still wins.
    <table ref={ref} className={cn('w-full min-w-[720px] text-sm', className)} {...props} />
  ),
);
Table.displayName = 'Table';

export interface TableHeadCol {
  key: string;
  label: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  tooltip?: string;
  width?: string;
}

export function TableHead({ columns }: { columns: TableHeadCol[] }) {
  return (
    <thead className="bg-bg-subtle sticky top-0 z-10 shadow-[0_1px_0_0_var(--color-border),0_2px_8px_-4px_rgba(31,27,22,0.08)]">
      <tr>
        {columns.map((c) => (
          <th
            key={c.key}
            className={cn(
              'text-text-secondary px-5 py-4 text-[0.65rem] font-semibold tracking-[0.15em] whitespace-nowrap uppercase',
              c.align === 'right' && 'text-right',
              c.align === 'center' && 'text-center',
              !c.align && 'text-left',
            )}
            style={c.width ? { width: c.width } : undefined}
          >
            {c.tooltip ? (
              <Tooltip content={c.tooltip} side="bottom">
                <span className="cursor-help border-b border-dotted border-current/40 pb-0.5">
                  {c.label}
                </span>
              </Tooltip>
            ) : (
              c.label
            )}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-border last:border-b-0 hover:bg-bg-base/70 border-b align-top transition-colors',
      className,
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }
>(({ className, align, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-5 py-4',
      align === 'right' && 'text-right',
      align === 'center' && 'text-center',
      className,
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';
