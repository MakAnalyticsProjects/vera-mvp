import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

/**
 * Ad-hoc verification for the BriefingCard source-chip overflow fix.
 * Sources mocked in-test so we can include a deliberately long URL/title.
 * Asserts every chip's bounding rect stays within the chip-list parent at
 * 375px viewport — the bug the user spotted in the screenshot.
 */
test('mobile · briefing chips never overflow their list', async ({ context, page }) => {
  await signInAs(context);
  await page.setViewportSize({ width: 375, height: 900 });

  await page.route('**/api/briefings/regenerate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        briefing: {
          headline: 'Storm signals are tightening',
          bodyMd: 'Watching **$48,200** across three jobs.',
          sources: [
            { type: 'nws', label: 'Flood Warning', detail: 'Severe', url: 'https://www.weather.gov/' },
            { type: 'nws', label: 'Special Weather Statement', detail: 'Moderate', url: 'https://www.weather.gov/' },
            { type: 'nws', label: 'Freeze Warning', detail: 'Minor', url: 'https://www.weather.gov/' },
            { type: 'news', label: 'What to Do After a Storm: A Chimney Inspection Walkthrough That Saves Insurance Headaches', detail: 'Socialmediaexplorer.com', url: 'https://example.com/a' },
            { type: 'news', label: 'Guy finds a cat trapped in his sky roof, the internet completely loses it', detail: 'Cheezburger.com', url: 'https://example.com/b' },
            { type: 'news', label: 'Top 5 Storm Damage Roof Repair Companies in North Texas Worth Calling First', detail: 'Ahousefinthehills.com', url: 'https://example.com/c' },
          ],
          generatedAt: new Date().toISOString(),
          model: 'gpt-4o',
        },
      }),
    });
  });

  await page.goto('/dashboard');
  await page.getByRole('button', { name: /Fetch latest news/i }).click();
  await expect(page.getByText(/Today.s news, woven in/i)).toBeVisible();

  const list = page.locator('ul', { has: page.locator('li', { hasText: /NWS/i }) }).first();
  const listBox = await list.boundingBox();
  expect(listBox).not.toBeNull();

  const chips = list.locator('li');
  const count = await chips.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const box = await chips.nth(i).boundingBox();
    expect(box, `chip ${i} has a bounding box`).not.toBeNull();
    if (!box || !listBox) continue;
    // Right edge of the chip must not exceed the list's right edge.
    expect(box.x + box.width, `chip ${i} stays within list width`).toBeLessThanOrEqual(
      // 1.5px tolerance for browser sub-pixel layout rounding.
      listBox.x + listBox.width + 1.5,
    );
  }

  // Visual receipt for the fix.
  await page.screenshot({
    path: 'tests/e2e/audit-screens/briefing-chips-mobile.png',
    fullPage: false,
  });
});
