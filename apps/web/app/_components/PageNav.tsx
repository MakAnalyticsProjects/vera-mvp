'use client';

import { useEffect, useState } from 'react';
import { cn } from '@vera/ui';

export interface PageNavSection {
  id: string;
  label: string;
}

/**
 * Sticky table-of-contents nav with scrollspy. Watches the listed section IDs
 * via IntersectionObserver and highlights whichever section is currently
 * sitting in the upper band of the viewport.
 *
 * Designed to live in a left rail next to a long, anchored page (used on
 * /design and /docs). Sections must each have an `id` attribute and the
 * page should set `scroll-mt-24` (or similar) on each section so anchor
 * jumps land below the sticky page header.
 */
export function PageNav({
  sections,
  className,
  topOffset = 96,
}: {
  sections: PageNavSection[];
  className?: string;
  /** Pixels from the top of the viewport reserved for the sticky page header. */
  topOffset?: number;
}) {
  const [activeId, setActiveId] = useState<string | null>(
    sections[0]?.id ?? null,
  );

  useEffect(() => {
    if (sections.length === 0) return;

    const ids = sections.map((s) => s.id);
    // Tracks the LATEST intersection state for every section so we can pick
    // the topmost intersecting section on every observer fire.
    const visibility = new Map<string, boolean>();
    ids.forEach((id) => visibility.set(id, false));

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visibility.set(e.target.id, e.isIntersecting);
        }
        // Pick the first section in document order that's intersecting.
        for (const s of sections) {
          if (visibility.get(s.id)) {
            setActiveId(s.id);
            return;
          }
        }
        // Nothing intersecting (e.g., between sections): keep the last value.
      },
      {
        // Effective viewport: from `topOffset` px below the top, down to 40% above the bottom.
        // A section becomes active as its top crosses into that band.
        rootMargin: `-${topOffset}px 0px -55% 0px`,
        threshold: 0,
      },
    );

    const observed: HTMLElement[] = [];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        obs.observe(el);
        observed.push(el);
      }
    }

    return () => {
      observed.forEach((el) => obs.unobserve(el));
      obs.disconnect();
    };
  }, [sections, topOffset]);

  return (
    <nav
      aria-label="On this page"
      className={cn('sticky top-[96px] border-l border-border', className)}
    >
      <p className="text-text-muted mb-3 px-3 text-[0.65rem] font-semibold tracking-[0.18em] uppercase">
        On this page
      </p>
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const isActive = activeId === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? 'true' : undefined}
                className={cn(
                  '-ml-px block border-l-2 px-3 py-1 text-sm transition-colors',
                  isActive
                    ? 'border-accent text-text-primary font-medium'
                    : 'text-text-secondary hover:text-text-primary border-transparent',
                )}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
