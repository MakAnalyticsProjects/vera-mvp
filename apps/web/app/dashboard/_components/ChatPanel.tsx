'use client';

import { useChat } from 'ai/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@vera/ui';

const SUGGESTIONS = [
  "Who's worst this week?",
  'Anything weird I should know about?',
  'Draft a follow-up for the highest-heat job.',
];

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/chat',
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const trigger = (
    <button
      onClick={() => setOpen(true)}
      className="bg-accent fixed right-6 bottom-6 z-30 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg transition-shadow hover:shadow-xl"
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      Ask Vera
    </button>
  );

  const sheet =
    open && mounted ? (
      createPortal(
        <div
          className="fixed inset-0 z-[90] flex justify-end bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Chat with Vera"
          onClick={() => setOpen(false)}
        >
          <aside
            className="bg-bg-card border-border flex h-full w-full max-w-xl flex-col border-l shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="border-border flex items-start justify-between gap-4 border-b px-7 py-5">
              <div>
                <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
                  Chatting with
                </p>
                <p className="font-display mt-1 text-2xl tracking-tight">Vera</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-text-muted hover:text-text-primary -mr-2 rounded-full p-2 transition-colors"
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-6">
              {messages.length === 0 ? (
                <div className="space-y-6">
                  <p className="text-text-secondary text-sm leading-relaxed">
                    I can talk through any AR question, summarise a rep&apos;s situation, or
                    draft a follow-up email. What&apos;s on your mind?
                  </p>
                  <div className="space-y-2">
                    <p className="text-text-muted text-[0.65rem] tracking-[0.2em] uppercase">
                      Try asking
                    </p>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => append({ role: 'user', content: s })}
                        className="border-border hover:border-accent text-text-primary w-full rounded-2xl border bg-transparent px-4 py-3 text-left text-sm transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {messages.map((m) => {
                    if (m.role !== 'user' && m.role !== 'assistant') return null;
                    const text = extractText(m);
                    if (!text.trim()) return null;
                    const isVera = m.role === 'assistant';
                    if (isVera) {
                      return (
                        <div
                          key={m.id}
                          className="border-accent text-text-primary max-w-[95%] border-l-2 pl-4 text-sm leading-relaxed"
                        >
                          <MarkdownMessage text={text} />
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className="flex justify-end">
                        <div className="bg-bg-base text-text-primary max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap">
                          {text}
                        </div>
                      </div>
                    );
                  })}
                  {isLoading ? (
                    <p className="text-text-muted text-sm italic">Vera is thinking…</p>
                  ) : null}
                </div>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-border bg-bg-card border-t px-5 py-4"
            >
              <div className="border-border focus-within:border-accent flex items-center gap-2 rounded-full border px-1 py-1 pl-5">
                <input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask Vera anything about AR…"
                  className="text-text-primary placeholder:text-text-muted flex-1 bg-transparent text-sm outline-none"
                  aria-label="Message"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || input.trim().length === 0}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </aside>
        </div>,
        document.body,
      )
    ) : null;

  return (
    <>
      {!open ? trigger : null}
      {sheet}
    </>
  );
}

/** Themed markdown renderer for Vera's replies. */
function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="vera-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({ children }) => (
            <strong className="text-text-primary font-semibold">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => (
            <h3 className="font-display mt-4 mb-2 text-lg font-medium tracking-tight">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="font-display mt-4 mb-2 text-base font-medium tracking-tight">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h3 className="text-text-primary mt-3 mb-1 text-sm font-semibold">{children}</h3>
          ),
          code: ({ children }) => (
            <code className="bg-bg-base text-text-primary rounded px-1 py-0.5 text-[0.85em]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-bg-base mb-3 overflow-x-auto rounded-lg p-3 text-xs">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-accent underline-offset-2 hover:underline">
              {children}
            </a>
          ),
          hr: () => <hr className="border-border my-3" />,
          blockquote: ({ children }) => (
            <blockquote className="border-accent text-text-secondary mb-3 border-l-2 pl-3 italic">
              {children}
            </blockquote>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function extractText(message: { content?: unknown; parts?: unknown[] }): string {
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.parts)) {
    return message.parts
      .map((part) => {
        if (
          part &&
          typeof part === 'object' &&
          'type' in part &&
          (part as { type: string }).type === 'text'
        ) {
          return (part as { text?: string }).text ?? '';
        }
        return '';
      })
      .join('');
  }
  return '';
}
