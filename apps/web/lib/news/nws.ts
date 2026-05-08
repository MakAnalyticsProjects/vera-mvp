import 'server-only';

/**
 * National Weather Service (NWS) alerts fetcher.
 * Free, government-run, no API key. Storms drive lead volume for roofers,
 * so this is the most relevant news signal we have.
 *
 * Docs: https://www.weather.gov/documentation/services-web-api
 */

export interface NWSAlert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  area: string;
  effective: string;
  expires: string;
  /** Public-facing weather.gov URL for the alert (when extractable). */
  url?: string;
}

/**
 * Fetch active alerts for a given US state. Returns at most `limit` alerts
 * sorted by severity (Extreme > Severe > Moderate > Minor). Returns empty
 * array on any error — never throws — so the briefing pipeline can degrade
 * gracefully.
 */
export async function fetchNWSAlerts(
  state: string,
  limit = 3,
): Promise<NWSAlert[]> {
  try {
    const res = await fetch(
      `https://api.weather.gov/alerts/active?area=${encodeURIComponent(state)}`,
      {
        headers: {
          'User-Agent': 'vera-mvp/1.0 (developer@levich.co)',
          Accept: 'application/geo+json',
        },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      features?: Array<{
        id: string;
        properties: {
          event: string;
          headline: string;
          severity: string;
          areaDesc: string;
          effective: string;
          expires: string;
        };
      }>;
    };
    const features = json.features ?? [];
    const SEVERITY_RANK: Record<string, number> = {
      Extreme: 0,
      Severe: 1,
      Moderate: 2,
      Minor: 3,
      Unknown: 4,
    };
    return features
      .map((f) => ({
        id: f.id,
        event: f.properties.event,
        headline: f.properties.headline,
        severity: f.properties.severity,
        area: f.properties.areaDesc,
        effective: f.properties.effective,
        expires: f.properties.expires,
        // Per-alert permalinks aren't reliably available and the legacy
        // alerts.weather.gov pages 404, so we just send users to the NWS
        // homepage where they can drill in by region.
        url: 'https://www.weather.gov/',
      }))
      .sort(
        (a, b) =>
          (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9),
      )
      .slice(0, limit);
  } catch {
    return [];
  }
}
