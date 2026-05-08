import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

/**
 * BriefingCard two-state flow:
 *   State A — no AI briefing yet → orange CTA card "Want today's news…"
 *   State C — AI briefing exists → headline, markdown body, source chips,
 *             "AI-generated" disclaimer, refresh affordance
 *
 * /api/briefings/regenerate is mocked so the spec doesn't burn an OpenAI call
 * or depend on NWS/NewsAPI uptime.
 */

const MOCK_BRIEFING = {
  ok: true,
  briefing: {
    headline: 'Insurance receivables tightening — three jobs are aging fast',
    bodyMd:
      "I'm watching **$48,200** across three jobs that crossed **60 days past terms** overnight. " +
      "**Mike Sanchez** has two of them — **Carol Whitfield's** Plano roof at heat **88** is the most urgent.\n\n" +
      "No severe weather in the metro, so leads are quiet. I'd nudge Mike on Whitfield this morning.",
    sources: [
      {
        type: 'nws',
        label: 'No active alerts',
        detail: 'Minor',
        url: 'https://www.weather.gov/',
      },
      {
        type: 'news',
        label: 'Roofing industry feels insurance-claim slowdown in Q1',
        detail: 'Roofing Contractor',
        url: 'https://example.com/roofing-contractor-q1',
      },
    ],
    generatedAt: new Date().toISOString(),
    model: 'gpt-4o',
  },
};

test.describe('BriefingCard', () => {
  test.beforeEach(async ({ context, page }) => {
    await signInAs(context);
    // Mock the regenerate endpoint so we don't hit the real LLM.
    await page.route('**/api/briefings/regenerate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_BRIEFING),
      });
    });
  });

  test('State A: shows the Fetch latest news CTA when no AI briefing exists', async ({ page }) => {
    await page.goto('/dashboard');

    // CTA copy
    await expect(page.getByText(/Vera.s news radar/i)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Fetch latest news/i }),
    ).toBeVisible();

    // The deleted static briefing should NOT render anymore
    await expect(page.getByText(/Good morning/i)).toHaveCount(0);
  });

  test('State C: clicking Fetch swaps in the AI briefing card', async ({ page }) => {
    await page.goto('/dashboard');

    const fetchBtn = page.getByRole('button', { name: /Fetch latest news/i });
    await expect(fetchBtn).toBeVisible();
    await fetchBtn.click();

    // Header strip flips to the State-C label
    await expect(page.getByText(/Today.s news, woven in/i)).toBeVisible();

    // Headline renders
    await expect(
      page.getByText(/Insurance receivables tightening/i),
    ).toBeVisible();

    // Bolded markdown actually renders as <strong> (not literal **)
    const strong = page.locator('strong', { hasText: '$48,200' });
    await expect(strong).toBeVisible();

    // AI-generated disclaimer
    await expect(page.getByText(/AI-generated/i).first()).toBeVisible();

    // Source chips: NWS chip points at weather.gov; News chip carries detail
    const nwsLink = page.getByRole('link', { name: /NWS/i });
    await expect(nwsLink).toBeVisible();
    await expect(nwsLink).toHaveAttribute('href', 'https://www.weather.gov/');

    // Refresh affordance is present in State C
    await expect(page.getByRole('button', { name: /^Refresh$/i })).toBeVisible();
  });
});
