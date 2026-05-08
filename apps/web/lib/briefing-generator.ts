import 'server-only';
import OpenAI from 'openai';
import { getData } from '@/lib/data';
import { fetchNWSAlerts, type NWSAlert } from '@/lib/news/nws';
import { fetchNewsHeadlines, type NewsHeadline } from '@/lib/news/newsapi';
import { db } from '@/lib/db';
import type { ARJob } from '@vera/types';

/**
 * Briefing generator. Takes a tenant, gathers today's stats + diff from
 * yesterday + top critical jobs + news context, calls gpt-4o, parses the
 * result into a `headline` + `bodyMd`, writes a `Briefing` row, returns it.
 *
 * Designed so any single failure (LLM, NWS, NewsAPI) degrades gracefully:
 *  - News fetchers return [] on error — briefing renders without news context.
 *  - LLM error throws; the cron route swallows and the dashboard falls back
 *    to the static composeBriefing.
 */

export interface BriefingSources {
  nws: NWSAlert[];
  news: NewsHeadline[];
}

export interface GenerateBriefingResult {
  briefingId: number;
  headline: string;
  bodyMd: string;
  keyJobs: KeyJob[];
  sources?: BriefingSources;
  promptTokens?: number;
  completionTokens?: number;
}

export interface KeyJob {
  id: number;
  address: string;
  rep: string | null;
  customerName: string | null;
  balance: number;
  daysPastTerms: number;
  heatScore: number;
}

export async function generateBriefingForTenant(
  tenantId: number,
): Promise<GenerateBriefingResult> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const { jobs } = getData();
  const stats = computeStats(jobs);
  const yesterday = await getYesterdaySnapshot(tenantId);

  const region = inferStateFromTenantSlug(tenant.slug);
  const [nwsAlerts, newsHeadlines] = await Promise.all([
    fetchNWSAlerts(region.state, 3),
    fetchNewsHeadlines(undefined, 3),
  ]);

  const prompt = buildPrompt({
    tenantName: tenant.name,
    stats,
    yesterday,
    nwsAlerts,
    newsHeadlines,
  });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: VERA_SYSTEM_PROMPT,
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message.content ?? '{}';
  const parsed = JSON.parse(raw) as { headline: string; bodyMd: string };

  const briefing = await db.briefing.create({
    data: {
      tenantId,
      headline: parsed.headline ?? 'AR briefing',
      bodyMd: parsed.bodyMd ?? '',
      keyJobs: {
        topCritical: stats.topCritical,
        sources: { nws: nwsAlerts, news: newsHeadlines },
      } as unknown as object,
      model: 'gpt-4o',
      promptTokens: completion.usage?.prompt_tokens ?? null,
      completionTokens: completion.usage?.completion_tokens ?? null,
    },
  });

  return {
    briefingId: briefing.id,
    headline: briefing.headline,
    bodyMd: briefing.bodyMd,
    keyJobs: stats.topCritical,
    sources: { nws: nwsAlerts, news: newsHeadlines },
    promptTokens: completion.usage?.prompt_tokens,
    completionTokens: completion.usage?.completion_tokens,
  };
}

/**
 * DB-free preview of the briefing generator. Used for local testing before
 * the database is provisioned. Same news fetch + LLM prompt as the real
 * generator, but skips the tenant lookup and the briefing-row write.
 */
export async function previewBriefing(): Promise<{
  headline: string;
  bodyMd: string;
  keyJobs: KeyJob[];
  context: {
    nwsAlerts: NWSAlert[];
    newsHeadlines: NewsHeadline[];
  };
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}> {
  const { jobs } = getData();
  const stats = computeStats(jobs);

  const [nwsAlerts, newsHeadlines] = await Promise.all([
    fetchNWSAlerts('TX', 3),
    fetchNewsHeadlines(undefined, 3),
  ]);

  const prompt = buildPrompt({
    tenantName: 'Priority Roofs · Dallas',
    stats,
    yesterday: null,
    nwsAlerts,
    newsHeadlines,
  });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: VERA_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0]?.message.content ?? '{}';
  const parsed = JSON.parse(raw) as { headline: string; bodyMd: string };

  return {
    headline: parsed.headline ?? 'AR briefing',
    bodyMd: parsed.bodyMd ?? '',
    keyJobs: stats.topCritical,
    context: { nwsAlerts, newsHeadlines },
    model: 'gpt-4o',
    promptTokens: completion.usage?.prompt_tokens,
    completionTokens: completion.usage?.completion_tokens,
  };
}

const VERA_SYSTEM_PROMPT = `You are Vera Calloway — Lead AR Intelligence Specialist for a roofing company. Your voice is warm, composed, lightly editorial — like a senior controller catching up with a colleague. You write a fresh morning briefing each day for the GM.

Output strict JSON only. Schema:
{
  "headline": string  // ONE short sentence (under 14 words). The single most interesting story today.
                      // PLAIN TEXT ONLY — no markdown, no ** ** asterisks, no italics. The UI styles it.
  "bodyMd": string    // SHORT briefing in markdown. STRICT: at most 2 paragraphs, each at most 3 sentences. No filler.
                      // Reference at least one rep and one customer by name from the top critical jobs.
                      // Weave in storm/news context only if it's directly relevant to AR exposure.
                      // **Bold** the most important specific facts: dollar amounts, customer names, days past terms, heat scores. Use markdown ** ** syntax. Bold sparingly — 3 to 5 phrases per briefing.
                      // Never alarmist. Never invent jobs, reps, or numbers.
}

Use the first person ("I'm watching…" / "I'd nudge Mike…"). Tight prose, no preamble, no sign-off.`;

interface BriefingStats {
  arJobCount: number;
  totalAR: number;
  pastTermsCount: number;
  pastTermsTotal: number;
  criticalCount: number;
  hotCount: number;
  fellThroughCount: number;
  topCritical: KeyJob[];
}

function computeStats(jobs: ARJob[]): BriefingStats {
  const totalAR = jobs.reduce((s, j) => s + j.balance, 0);
  const pastTerms = jobs.filter((j) => j.daysPastTerms > 0);
  const critical = jobs.filter((j) => j.heatBand === 'critical');
  const hot = jobs.filter((j) => j.heatBand === 'hot');
  const fellThrough = jobs.filter((j) => j.fellThroughCracks);
  const topCritical: KeyJob[] = [...jobs]
    .sort((a, b) => b.heatScore - a.heatScore)
    .slice(0, 5)
    .map((j) => ({
      id: j.id,
      address: j.address,
      rep: j.rep?.name ?? null,
      customerName: j.customerName ?? null,
      balance: j.balance,
      daysPastTerms: j.daysPastTerms,
      heatScore: j.heatScore,
    }));
  return {
    arJobCount: jobs.length,
    totalAR,
    pastTermsCount: pastTerms.length,
    pastTermsTotal: pastTerms.reduce((s, j) => s + j.balance, 0),
    criticalCount: critical.length,
    hotCount: hot.length,
    fellThroughCount: fellThrough.length,
    topCritical,
  };
}

async function getYesterdaySnapshot(
  tenantId: number,
): Promise<BriefingStats | null> {
  // Look up the previous briefing's keyJobs as a rough "yesterday" reference.
  // Once we have a daily snapshot table this gets smarter.
  const previous = await db.briefing.findFirst({
    where: { tenantId },
    orderBy: { generatedAt: 'desc' },
  });
  if (!previous) return null;
  // We didn't store a full stats blob historically; return null and the
  // prompt simply won't have a diff. Will be richer once we capture daily
  // aggregate snapshots.
  void previous;
  return null;
}

function inferStateFromTenantSlug(slug: string): { state: string } {
  // For Priority Roofs Dallas, the relevant state is Texas (TX). Future
  // tenants will store this on the tenant row directly.
  if (slug.includes('dallas') || slug.includes('texas')) return { state: 'TX' };
  return { state: 'TX' };
}

function buildPrompt(input: {
  tenantName: string;
  stats: BriefingStats;
  yesterday: BriefingStats | null;
  nwsAlerts: NWSAlert[];
  newsHeadlines: NewsHeadline[];
}): string {
  const { tenantName, stats, nwsAlerts, newsHeadlines } = input;
  return `Tenant: ${tenantName}

Today's AR stats:
- AR jobs: ${stats.arJobCount}
- Total AR: $${Math.round(stats.totalAR).toLocaleString()}
- Past terms: ${stats.pastTermsCount} jobs · $${Math.round(stats.pastTermsTotal).toLocaleString()}
- Critical (heat 76+): ${stats.criticalCount}
- Hot (heat 51-75): ${stats.hotCount}
- Fell through cracks: ${stats.fellThroughCount}

Top 5 critical jobs:
${stats.topCritical
  .map(
    (j) =>
      `- ${j.address} · ${j.customerName ?? 'unknown customer'} · rep ${j.rep ?? 'unassigned'} · $${j.balance.toLocaleString()} · ${j.daysPastTerms}d past · heat ${j.heatScore}`,
  )
  .join('\n')}

${
  nwsAlerts.length > 0
    ? `Active NWS weather alerts (${nwsAlerts.length}):\n${nwsAlerts
        .map((a) => `- ${a.severity}: ${a.event} — ${a.headline}`)
        .join('\n')}`
    : 'No active severe weather alerts in the region today.'
}

${
  newsHeadlines.length > 0
    ? `Industry headlines:\n${newsHeadlines
        .map((h) => `- ${h.title} (${h.source})`)
        .join('\n')}`
    : 'No notable industry headlines today.'
}

Write today's briefing. Reference at least one specific rep or customer by name from the top critical jobs. If a weather alert is severe and could feed lead volume, weave that in. Tone: composed, observational, never alarmist. Output JSON only.`;
}
