'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sheet width in tailwind class form. Default 'max-w-xl'. */
  widthClass?: string;
}

/**
 * Right-side sheet rendered into document.body via portal. Esc closes.
 * Body scroll locked while open. Click on overlay also closes.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  widthClass = 'max-w-xl',
}: SheetProps) {
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onOpenChange]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex justify-end bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => onOpenChange(false)}
    >
      <aside
        className={cn(
          'bg-bg-card border-border flex h-full w-full flex-col border-l shadow-2xl',
          widthClass,
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-border flex items-start justify-between gap-4 border-b px-7 py-5">
          <div className="min-w-0 flex-1">
            {title ? (
              <div className="font-display text-2xl tracking-tight">{title}</div>
            ) : null}
            {description ? (
              <p className="text-text-secondary mt-1 text-sm">{description}</p>
            ) : null}
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-text-muted hover:text-text-primary -mr-2 rounded-full p-2 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-7 py-6">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
