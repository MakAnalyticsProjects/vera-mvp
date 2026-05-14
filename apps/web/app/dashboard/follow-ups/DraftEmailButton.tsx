'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import { Button, EmailChipInput, toast, useConfirm } from '@vera/ui';

type Mode = 'preview' | 'compose';

export function DraftEmailButton({
  jobId,
  jobAddress,
  repName,
  repEmail,
  subject: initialSubject,
  body: initialBody,
}: {
  jobId: number;
  jobAddress: string;
  repName: string;
  repEmail: string;
  subject: string;
  body: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('preview');
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sending, setSending] = useState(false);

  const initialTo = useMemo(
    () => [repEmail.trim().toLowerCase()],
    [repEmail],
  );
  const [to, setTo] = useState<string[]>(initialTo);
  const [cc, setCc] = useState<string[]>([]);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);

  const confirm = useConfirm();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAndReset();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  function closeAndReset() {
    setOpen(false);
    setMode('preview');
    setTo(initialTo);
    setCc([]);
    setSubject(initialSubject);
    setBody(initialBody);
    setCopied(false);
  }

  function copy() {
    navigator.clipboard
      .writeText(`Subject: ${subject}\n\n${body}`)
      .then(() => {
        setCopied(true);
        toast.success('Copied to clipboard');
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast.error('Copy failed');
      });
  }

  const canSend =
    to.length > 0 &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    !sending;

  async function send() {
    if (!canSend) return;
    const recipientLabel =
      to.length === 1 ? to[0] : `${to.length} recipients`;
    const ok = await confirm({
      title: `Send follow-up to ${recipientLabel}`,
      description:
        cc.length > 0
          ? `Vera will send this email now, cc'ing ${cc.length} additional ${cc.length === 1 ? 'person' : 'people'}. The send is logged in the audit trail.`
          : 'Vera will send this email now. The send is logged in the audit trail.',
      confirmLabel: 'Send now',
      cancelLabel: 'Keep editing',
    });
    if (!ok) return;

    setSending(true);
    try {
      const res = await fetch('/api/follow-ups/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jobId,
          jobAddress,
          repName,
          to,
          cc,
          subject,
          body,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        toast.error(data?.error?.message ?? 'Send failed');
        return;
      }
      toast.success(`Sent to ${recipientLabel}`);
      closeAndReset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  const modal =
    open && mounted ? (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-email-title"
        onClick={closeAndReset}
      >
        <div
          className="bg-bg-card border-border flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-border flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4 sm:px-7 sm:py-5">
            <div className="min-w-0">
              <p
                id="draft-email-title"
                className="text-text-muted truncate text-[0.65rem] tracking-[0.2em] uppercase"
              >
                {mode === 'preview' ? `Draft for ${repName}` : `Compose to ${repName}`}
              </p>
              <p className="text-text-secondary mt-1 truncate text-sm">{jobAddress}</p>
            </div>
            <button
              onClick={closeAndReset}
              className="text-text-muted hover:text-text-primary -mr-2 shrink-0 rounded-full p-2 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {mode === 'preview' ? (
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <div>
                <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
                  To
                </p>
                <p className="text-text-primary mt-1.5 text-sm">{repEmail}</p>
              </div>
              <div>
                <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
                  Subject
                </p>
                <p className="font-display mt-1.5 text-lg">{subject}</p>
              </div>
              <div>
                <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
                  Body
                </p>
                <pre className="text-text-primary mt-2 font-sans text-sm leading-relaxed whitespace-pre-wrap">
                  {body}
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <FromField />
              <Field label="To" htmlFor="follow-up-to">
                <EmailChipInput
                  ariaLabel="To"
                  value={to}
                  onChange={setTo}
                  max={6}
                  invalid={to.length === 0}
                  helperText={
                    to.length === 0
                      ? 'Add at least one recipient.'
                      : 'Press Enter or comma to add. Up to 6 recipients.'
                  }
                />
              </Field>
              <Field label="Cc (optional)" htmlFor="follow-up-cc">
                <EmailChipInput
                  ariaLabel="Cc"
                  value={cc}
                  onChange={setCc}
                  max={6}
                  placeholder="cc@company.com"
                  helperText="Optional. Press Enter or comma to add."
                />
              </Field>
              <Field label="Subject" htmlFor="follow-up-subject">
                <input
                  id="follow-up-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="border-border focus:border-accent bg-bg-card text-text-primary placeholder:text-text-muted w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors"
                  placeholder="Subject"
                />
              </Field>
              <Field label="Body" htmlFor="follow-up-body">
                <textarea
                  id="follow-up-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="border-border focus:border-accent bg-bg-card text-text-primary placeholder:text-text-muted w-full resize-y rounded-xl border px-3 py-2.5 font-sans text-sm leading-relaxed outline-none transition-colors"
                />
              </Field>
            </div>
          )}

          <div className="bg-bg-base/40 border-border flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-5 py-3 sm:gap-3 sm:px-7 sm:py-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="md" onClick={copy}>
                {copied ? 'Copied ✓' : 'Copy to clipboard'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {mode === 'preview' ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => setMode('compose')}
                  aria-label="Send via Vera"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Send via Vera
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => setMode('preview')}
                    disabled={sending}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={send}
                    disabled={!canSend}
                  >
                    {sending ? 'Sending…' : 'Send'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Draft email
      </Button>
      {mounted ? createPortal(modal, document.body) : null}
    </>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-text-muted block text-[0.65rem] tracking-[0.2em] uppercase"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function FromField() {
  return (
    <div>
      <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">From</p>
      <div className="border-border bg-bg-soft/60 text-text-primary mt-1.5 flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm">
        <span className="truncate">Vera Calloway</span>
        <span className="text-text-muted shrink-0 text-[0.65rem] tracking-[0.2em] uppercase">
          Locked
        </span>
      </div>
      <p className="text-text-muted mt-1 px-0.5 text-xs">
        Sent from Vera&apos;s verified domain. The address can&apos;t be changed.
      </p>
    </div>
  );
}
