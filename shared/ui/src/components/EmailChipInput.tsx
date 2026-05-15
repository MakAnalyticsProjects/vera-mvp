'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

export type EmailChipInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Render a red border + caption when this is true. */
  invalid?: boolean;
  /** Surface below the field. Used for error messages or contextual help. */
  helperText?: string;
  className?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s);
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function splitPaste(raw: string): string[] {
  return raw
    .split(/[\s,;]+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function EmailChipInput({
  value,
  onChange,
  max = 6,
  placeholder = 'name@company.com',
  disabled,
  ariaLabel = 'Recipients',
  invalid,
  helperText,
  className,
}: EmailChipInputProps) {
  const [draft, setDraft] = React.useState('');
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const atCap = value.length >= max;

  function focusInput() {
    inputRef.current?.focus();
  }

  function tryCommit(raw: string): { ok: boolean; reason?: string } {
    const normalized = normalize(raw);
    if (!normalized) return { ok: true };
    if (!isValidEmail(normalized)) {
      return { ok: false, reason: 'Not a valid email address' };
    }
    if (value.includes(normalized)) {
      // Silent dedupe — no error, but treat as "consumed" so the draft clears.
      return { ok: true };
    }
    if (value.length >= max) {
      return { ok: false, reason: `Up to ${max} recipients` };
    }
    onChange([...value, normalized]);
    return { ok: true };
  }

  function commitDraft() {
    const result = tryCommit(draft);
    if (result.ok) {
      setDraft('');
      setDraftError(null);
    } else {
      setDraftError(result.reason ?? 'Invalid');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      // Only intercept Tab when there's a draft to commit — bare Tab should
      // still move focus naturally.
      if (e.key === 'Tab' && !draft.trim()) return;
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === 'Backspace' && draft.length === 0 && value.length > 0) {
      e.preventDefault();
      onChange(value.slice(0, -1));
      setDraftError(null);
      return;
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const raw = e.clipboardData.getData('text');
    if (!raw) return;
    const tokens = splitPaste(raw);
    if (tokens.length <= 1) return; // single token → let normal typing flow handle it
    e.preventDefault();
    const next = [...value];
    let firstError: string | null = null;
    for (const t of tokens) {
      const normalized = normalize(t);
      if (!normalized) continue;
      if (!isValidEmail(normalized)) {
        if (!firstError) firstError = `Skipped "${t}" — not a valid email`;
        continue;
      }
      if (next.includes(normalized)) continue;
      if (next.length >= max) {
        firstError = `Up to ${max} recipients — extras dropped`;
        break;
      }
      next.push(normalized);
    }
    onChange(next);
    setDraft('');
    setDraftError(firstError);
  }

  function removeAt(index: number) {
    const next = value.slice();
    next.splice(index, 1);
    onChange(next);
    setDraftError(null);
    focusInput();
  }

  function handleBlur() {
    // Commit whatever the operator typed before tabbing/clicking away — but
    // only if it's non-empty. Empty blur clears the inline error.
    if (draft.trim()) {
      commitDraft();
    } else {
      setDraftError(null);
    }
  }

  const showError = invalid || !!draftError;
  const counterTone = atCap
    ? 'text-heat-warm'
    : 'text-text-muted';

  return (
    <div className={cn('flex w-full flex-col gap-1.5', className)}>
      <div
        role="group"
        aria-label={ariaLabel}
        onClick={focusInput}
        className={cn(
          'flex w-full flex-wrap items-center gap-1.5 rounded-xl border px-3 py-2 text-sm transition-colors',
          'bg-bg-card cursor-text',
          showError
            ? 'border-heat-critical/60 focus-within:border-heat-critical'
            : 'border-border hover:border-accent/40 focus-within:border-accent',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {value.map((email, i) => (
          <span
            key={`${email}-${i}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full bg-bg-soft text-text-primary',
              'px-2.5 py-1 text-xs font-medium leading-none',
              'border-border/60 border',
            )}
          >
            <span className="max-w-[18rem] truncate">{email}</span>
            <button
              type="button"
              aria-label={`Remove ${email}`}
              onClick={(e) => {
                e.stopPropagation();
                if (disabled) return;
                removeAt(i);
              }}
              disabled={disabled}
              className={cn(
                'text-text-muted hover:text-text-primary inline-flex items-center justify-center',
                'rounded-full p-0.5 transition-colors',
                'disabled:cursor-not-allowed',
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          spellCheck={false}
          disabled={disabled || atCap}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (draftError) setDraftError(null);
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={handleBlur}
          placeholder={
            atCap ? `Remove a recipient to add another` : value.length === 0 ? placeholder : ''
          }
          aria-describedby="email-chip-helper"
          aria-invalid={showError ? 'true' : undefined}
          className={cn(
            'placeholder:text-text-muted text-text-primary',
            'flex-1 min-w-[10rem] bg-transparent text-sm outline-none',
            'disabled:cursor-not-allowed',
          )}
        />
      </div>

      <div
        id="email-chip-helper"
        className="flex items-center justify-between gap-3 px-0.5 text-xs"
      >
        <span
          className={cn(
            'transition-colors',
            draftError
              ? 'text-heat-critical'
              : invalid && helperText
                ? 'text-heat-critical'
                : 'text-text-muted',
          )}
        >
          {draftError ?? helperText ?? 'Press Enter or comma to add.'}
        </span>
        <span className={cn('font-medium tabular-nums', counterTone)}>
          {value.length} of {max}
        </span>
      </div>
    </div>
  );
}
