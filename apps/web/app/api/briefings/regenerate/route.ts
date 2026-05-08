import { NextResponse } from 'next/server';
import { generateBriefingForTenant } from '@/lib/briefing-generator';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Manual regenerate endpoint. Used by the "Regenerate" button on the
 * dashboard's BriefingCard. Rate-limited at the UI layer (one per hour).
 *
 * v1: hardcoded tenantId=1. Once auth lands (Phase 4), reads tenantId
 * from the session.
 */

const TENANT_ID_FALLBACK = 1;

export async function POST() {
  // TODO Phase 4: replace with session.user.tenantId
  const tenantId = TENANT_ID_FALLBACK;

  try {
    const result = await generateBriefingForTenant(tenantId);
    // Flatten sources into the BriefingSource[] shape the client renders.
    const sources: Array<{
      type: 'nws' | 'news';
      label: string;
      detail?: string;
      url?: string;
    }> = [];
    for (const a of result.sources?.nws ?? []) {
      sources.push({
        type: 'nws',
        label: a.event ?? a.headline ?? 'NWS alert',
        detail: a.severity,
        url: a.url,
      });
    }
    for (const h of result.sources?.news ?? []) {
      sources.push({
        type: 'news',
        label: h.title,
        detail: h.source,
        url: h.url,
      });
    }
    return NextResponse.json({
      ok: true,
      briefing: {
        headline: result.headline,
        bodyMd: result.bodyMd,
        sources,
        generatedAt: new Date().toISOString(),
        model: 'gpt-4o',
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
