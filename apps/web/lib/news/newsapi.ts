import 'server-only';

/**
 * NewsAPI.org fetcher for roofing-industry headlines. Free tier allows
 * ~100 req/day, plenty for one briefing per tenant per day.
 *
 * Docs: https://newsapi.org/docs
 *
 * Configure NEWSAPI_KEY env var. Without it, returns empty array (graceful
 * degrade — briefing generates without the news context).
 */

export interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  description: string | null;
}

export async function fetchNewsHeadlines(
  query = '"roof" AND ("damage" OR "insurance" OR "claim" OR "storm" OR "hail" OR "industry")',
  limit = 3,
): Promise<NewsHeadline[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      language: 'en',
      // Only match in title — avoids spurious hits from off-topic articles that
      // mention "roofing" in passing. Sort by relevancy so we get topical
      // headlines, not just the latest noise.
      searchIn: 'title',
      sortBy: 'relevancy',
      pageSize: String(limit * 3),
    });
    const res = await fetch(`https://newsapi.org/v2/everything?${params}`, {
      headers: {
        'X-Api-Key': apiKey,
        'User-Agent': 'vera-mvp/1.0',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      articles?: Array<{
        title: string;
        source: { name: string };
        url: string;
        publishedAt: string;
        description: string | null;
      }>;
    };
    // Final filter: drop anything whose title doesn't actually contain a
    // roofing/storm/insurance keyword. NewsAPI's q-matching can still
    // surface adjacent results otherwise.
    const KEYWORDS = /roof|hail|storm|insurance|claim/i;
    return (json.articles ?? [])
      .filter((a) => a.title && KEYWORDS.test(a.title))
      .slice(0, limit)
      .map((a) => ({
        title: a.title,
        source: a.source.name,
        url: a.url,
        publishedAt: a.publishedAt,
        description: a.description,
      }));
  } catch {
    return [];
  }
}
