import * as React from 'react';
import { cn } from '../lib/cn';
import { Tooltip } from './Tooltip';

export interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tooltip?: string;
  className?: string;
  emphasis?: 'default' | 'accent' | 'critical';
}

export function MetricTile({
  label,
  value,
  hint,
  tooltip,
  className,
  emphasis = 'default',
}: MetricTileProps) {
  const inner = (
    <div
      className={cn(
        'bg-bg-card border-border rounded-[var(--radius-card)] border p-5 flex h-full flex-col sm:p-8',
        tooltip && 'cursor-help',
        className,
      )}
    >
      <p className="text-text-muted text-[0.65rem] tracking-[0.18em] uppercase sm:text-xs">
        {label}
      </p>
      <p
        className={cn(
          'font-display mt-3 text-2xl tracking-tight tabular-nums sm:mt-4 sm:text-4xl',
          emphasis === 'accent' && 'text-accent',
          emphasis === 'critical' && 'text-heat-critical',
        )}
      >
        {value}
      </p>
      <p
        className={cn(
          'text-text-secondary mt-2 text-xs sm:mt-3 sm:text-sm',
          !hint && 'invisible',
        )}
        aria-hidden={!hint}
      >
        {hint ?? '\u00A0'}
      </p>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip content={tooltip} block triggerClassName="h-full">
        {inner}
      </Tooltip>
    );
  }

  return inner;
}
