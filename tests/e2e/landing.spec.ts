import { expect, test } from '@playwright/test';

test.describe('Landing page', () => {
  test('renders hero, feature cards, and assumptions', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Vera/);
    await expect(
      page.getByRole('heading', { name: /money that hasn.t come home yet/i }),
    ).toBeVisible();
    await expect(page.getByText('What I do, every morning')).toBeVisible();
    await expect(page.getByText('How I think')).toBeVisible();
    await expect(page.getByText(/A job is in AR only/)).toBeVisible();
  });

  test('CTA navigates to the dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Open the dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Today.s briefing/i })).toBeVisible();
  });
});
