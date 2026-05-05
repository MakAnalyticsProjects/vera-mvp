'use client';

import { useState } from 'react';
import { Button } from '@vera/ui';

export function DraftEmailButton({
  repName,
  repEmail,
  subject,
  body,
}: {
  repName: string;
  repEmail: string;
  subject: string;
  body: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  const mailto = `mailto:${repEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Draft email
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-bg-card border-border max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-[var(--radius-card)] border shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-border flex items-baseline justify-between border-b px-7 py-5">
              <div>
                <p className="text-text-muted text-xs tracking-[0.2em] uppercase">
                  Draft for {repName}
                </p>
                <p className="text-text-secondary mt-1 text-sm">{repEmail}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-text-primary text-sm"
                aria-label="Close"
              >
                Close
              </button>
            </div>
            <div className="space-y-4 px-7 py-6">
              <div>
                <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
                  Subject
                </p>
                <p className="font-display mt-1 text-lg">{subject}</p>
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
            <div className="border-border flex justify-end gap-2 border-t px-7 py-4">
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? 'Copied ✓' : 'Copy to clipboard'}
              </Button>
              <a href={mailto}>
                <Button size="sm">Open in mail</Button>
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
