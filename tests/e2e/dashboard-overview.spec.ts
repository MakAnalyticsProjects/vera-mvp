import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

test.describe('Dashboard overview (Today)', () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context);
  });

  test('renders heading, briefing CTA, and metric tiles', async ({ page }) => {
    await page.goto('/dashboard');

    // Page heading
    await expect(page.getByRole('heading', { name: /Today.s briefing/i })).toBeVisible();

    // Briefing area: either the State-A "Fetch latest news" CTA or the State-C
    // AI card. Both contain "Vera's news radar" / "Today's news, woven in"
    // accent strip — assert one of those landmarks.
    await expect(
      page
        .getByText(/Vera.s news radar|Today.s news, woven in/i)
        .first(),
    ).toBeVisible();

    // Four metric tiles
    await expect(page.getByText('Total AR')).toBeVisible();
    await expect(page.getByText('Critical', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Hot', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Fell through')).toBeVisible();

    // Top three section
    await expect(page.getByText(/Top three I.d look at first/i)).toBeVisible();
  });

  test('sidebar nav links work', async ({ page }) => {
    await page.goto('/dashboard');

    for (const slug of ['aging', 'milestones', 'follow-ups', 'rep-leaderboard', 'reconciliation']) {
      await page.goto(`/dashboard/${slug}`);
      // Stub renders a heading; just confirm the route resolves with no error.
      await expect(page.locator('h1')).toBeVisible();
    }
  });
});
