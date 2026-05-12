'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { Modal } from './Modal';

/**
 * Confirmation dialog — composes <Modal> and layers a direct, compact
 * confirmation layout on top. Shares the same display-serif title
 * typography as <Modal>, but adds:
 *
 *   ▸ Icon block to the left of the title (AlertTriangle by default,
 *     override via `icon`). Tints accent or heat-critical based on
 *     `destructive`. This is what visually distinguishes a confirmation
 *     from a content modal.
 *   ▸ Title in the canonical Modal heading style — `font-display text-2xl
 *     tracking-tight`, sentence-case imperative ("Cancel this run",
 *     "Save changes"), NOT a question.
 *   ▸ Description as the body — left-aligned to the modal edge.
 *   ▸ Right-aligned button row: secondary cancel + primary/destructive
 *     confirm. Hidden X close button — user must pick a button.
 *
 * For content modals (chat, info, custom forms) use <Modal> directly — it
 * lets your body own the layout. The design system page at
 * /design#toasts-modals shows both side by side.
 */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Imperative action label, NOT a question. Rendered in display-serif
   *  heading style (same as <Modal>). Sentence-case.
   *  e.g. "Cancel this run", "Remove schedule", "Delete user". */
  title: ReactNode;
  /** Main body text — what will happen, who's affected, blast radius. */
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirms get a red primary button. Icon color also shifts. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Override the icon. Default AlertTriangle. */
  icon?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  icon,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  // Enter-to-confirm — feels natural in a yes/no dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !busy) void handleConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, busy]);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
      hideCloseButton
      dismissOnBackdropClick={!busy}
      aria-label={typeof title === 'string' ? title : 'Confirm'}
    >
      <div data-testid="confirm-dialog">
        {/* Icon block (36px) is slightly taller than the title line box
            (~30px), so center-align both — top-aligning leaves the icon
            sitting visibly low next to the serif glyphs. Titles are
            single-line imperatives; if one ever wraps, add `self-start`
            to the icon and a small `mt-` to nudge it onto line 1. */}
        <div className="mb-4 flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
              destructive
                ? 'bg-heat-critical/10 text-heat-critical'
                : 'bg-accent/10 text-accent',
            )}
          >
            {icon ?? <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
          </div>
          <h2
            className="font-display text-text-primary text-2xl leading-tight tracking-tight"
            data-testid="confirm-dialog-title"
          >
            {title}
          </h2>
        </div>
        {description ? (
          <p className="text-text-secondary text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={busy}
          data-testid="confirm-dialog-cancel"
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant={destructive ? 'destructive' : 'primary'}
          size="sm"
          onClick={handleConfirm}
          disabled={busy}
          data-testid="confirm-dialog-confirm"
        >
          {busy ? '…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
