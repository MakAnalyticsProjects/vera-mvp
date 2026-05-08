import { NextResponse } from 'next/server';
import { previewBriefing } from '@/lib/briefing-generator';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Preview-only endpoint. Runs the AI briefing generator with real NWS +
 * NewsAPI data, returns headline + bodyMd + the news context that was used,
 * **without writing to the database**. Useful before the database is
 * provisioned so we can verify the prompt + news integration works.
 *
 * Returns JSON. Hit it via curl or browser.
 */
export async function GET() {
  try {
    const result = await previewBriefing();
    return NextResponse.json({ ok: true, ...result });
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
