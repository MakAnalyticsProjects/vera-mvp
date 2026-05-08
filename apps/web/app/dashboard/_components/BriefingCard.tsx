'use client';

import { useState } from 'react';
import { ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@vera/ui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Two-state briefing area.
 *
 *   State A — no AI briefing yet for the tenant.
 *     Renders a CTA card with accent styling that lets the user fetch
 *     today's AI briefing.
 *
 *   State C — AI briefing exists.
 *     The AI card replaces the CTA in place — same visual slot, different
 *     content. Shows headline, markdown body, source citations, generation
 *     time, and a small Refresh affordance.
 *
 * The "AI-generated" disclaimer is small and always present so it's
 * never unclear that an LLM produced the content.
 */

export interface BriefingSource {
  type: 'nws' | 'news';
  label: string;
  detail?: string;
  url?: string;
}

export interface AIBriefing {
  headline: string;
  bodyMd: string;
  sources: BriefingSource[];
  generatedAt: string; // ISO timestamp
  model: string;
}

export interface BriefingCardProps {
  /** The persisted AI briefing if one exists for the tenant. Null otherwise. */
  initialAi: AIBriefing | null;
  /** When true, the user can fetch / refresh the AI briefing. */
  canFetch?: boolean;
}

export function BriefingCard({
  initialAi,
  canFetch = true,
}: BriefingCardProps) {
  const [ai, setAi] = useState<AIBriefing | null>(initialAi);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchLatestNews() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/briefings/regenerate', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      setAi({
        headline: json.briefing.headline,
        bodyMd: json.briefing.bodyMd,
        sources: json.briefing.sources ?? [],
        generatedAt: json.briefing.generatedAt ?? new Date().toISOString(),
        model: json.briefing.model ?? 'gpt-4o',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setPending(false);
    }
  }

  // Either CTA (State A) or AI card (State C).
  return ai ? (
    <AIBriefingCard
      ai={ai}
      pending={pending}
      error={error}
      onRefresh={canFetch ? fetchLatestNews : undefined}
    />
  ) : (
    <FetchNewsCTA pending={pending} error={error} onFetch={fetchLatestNews} />
  );
}

// ─── State A — CTA card ─────────────────────────────────────────────────────

function FetchNewsCTA({
  pending,
  error,
  onFetch,
}: {
  pending: boolean;
  error: string | null;
  onFetch: () => void;
}) {
  return (
    <div className="border-accent/30 bg-accent/5 vera-callout-in relative overflow-hidden rounded-[var(--radius-card)] border-l-4 border-y border-r p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="bg-accent/15 text-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-xl">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <p className="text-accent text-[0.65rem] tracking-[0.2em] uppercase">
              Vera&apos;s news radar
            </p>
            <p className="font-display text-text-primary text-xl tracking-tight">
              Want today&apos;s news woven into your briefing?
            </p>
            <p className="text-text-secondary text-sm leading-relaxed">
              I&apos;ll pull severe weather alerts and roofing-industry headlines
              for your region and thread them through your AR picture in plain
              English.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button onClick={onFetch} disabled={pending} size="md">
              {pending ? (
                <>
                  <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  <span className="whitespace-nowrap">Fetching…</span>
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  <span className="whitespace-nowrap">Fetch latest news</span>
                </>
              )}
            </Button>
            <span className="text-text-muted text-[0.65rem] tracking-wide">
              AI-generated
            </span>
          </div>
          {error ? (
            <p className="text-heat-critical text-xs">{error}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── State C — AI briefing card ─────────────────────────────────────────────

function AIBriefingCard({
  ai,
  pending,
  error,
  onRefresh,
}: {
  ai: AIBriefing;
  pending: boolean;
  error: string | null;
  onRefresh?: () => void;
}) {
  const generatedAt = new Date(ai.generatedAt);
  const ageMinutes = Math.max(0, Math.floor((Date.now() - generatedAt.getTime()) / 60_000));
  const ageLabel =
    ageMinutes < 1
      ? 'just now'
      : ageMinutes < 60
        ? `${ageMinutes} min ago`
        : ageMinutes < 60 * 24
          ? `${Math.floor(ageMinutes / 60)} hr ago`
          : generatedAt.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            });

  return (
    <div className="border-accent/30 bg-accent/5 vera-callout-in relative overflow-hidden rounded-[var(--radius-card)] border-l-4 border-y border-r p-6 sm:p-7">
      {/* Header strip */}
      <div className="flex items-center gap-2.5">
        <span className="bg-accent/15 text-accent flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="text-accent text-[0.65rem] tracking-[0.2em] uppercase">
          Today&apos;s news, woven in
        </p>
      </div>

      {/* Headline + body. The arbitrary variant selectors style markdown
          output without requiring @tailwindcss/typography:
          - strong → bold + primary color so bolded keywords pop
          - p → spacing between paragraphs
          - a → accent color underline */}
      <div className="mt-4 space-y-3">
        <p className="font-display text-text-primary text-xl leading-snug tracking-tight">
          {ai.headline}
        </p>
        <div
          className={
            'text-text-secondary text-sm leading-relaxed ' +
            '[&_p]:mb-2 [&_p:last-child]:mb-0 ' +
            '[&_strong]:text-text-primary [&_strong]:font-semibold ' +
            '[&_a]:text-accent [&_a]:underline-offset-2 hover:[&_a]:underline'
          }
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{ai.bodyMd}</ReactMarkdown>
        </div>
      </div>

      {/* Sources / citations */}
      {ai.sources.length > 0 ? (
        <div className="border-accent/20 mt-5 border-t pt-4">
          <p className="text-text-muted text-[0.6rem] tracking-[0.2em] uppercase">
            Sources
          </p>
          <ul className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {ai.sources.map((s, i) => (
              <li key={i} className="min-w-0 max-w-full">
                <SourceChip source={s} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Footer — generated time + refresh */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-accent/20 pt-3">
        <p className="text-text-muted text-[0.65rem]">
          Generated {ageLabel} · AI-generated, may not be perfect
        </p>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={pending}
            className="text-accent hover:text-accent/80 inline-flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={pending ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
            {pending ? 'Refreshing…' : 'Refresh'}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-heat-critical mt-2 text-xs">{error}</p>
      ) : null}
    </div>
  );
}

// ─── Source citation chip ───────────────────────────────────────────────────

function SourceChip({ source }: { source: BriefingSource }) {
  const sourceLabel = source.type === 'nws' ? 'NWS' : source.detail ?? 'News';
  const inner = (
    <span className="border-accent/30 bg-bg-card hover:border-accent/60 flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] transition-colors">
      <span className="text-accent shrink-0 font-medium whitespace-nowrap">{sourceLabel}</span>
      <span className="text-text-muted shrink-0">·</span>
      <span
        className="text-text-secondary min-w-0 flex-1 truncate"
        title={source.label}
      >
        {source.label}
      </span>
      {source.url ? (
        <ExternalLink className="text-text-muted h-2.5 w-2.5 shrink-0" />
      ) : null}
    </span>
  );
  // On mobile each chip is its own row (parent ul is flex-col), so w-full
  // caps it at the row width and the inner truncate finally kicks in. From
  // sm: up, the parent flips to flex-wrap and chips become pills with a cap.
  const wrapperCls =
    'block w-full sm:w-auto sm:max-w-[280px] md:max-w-[340px]';
  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapperCls}
      >
        {inner}
      </a>
    );
  }
  return <div className={wrapperCls}>{inner}</div>;
}
