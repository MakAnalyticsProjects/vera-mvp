import { expect, test } from '@playwright/test';

test.describe('Aging & anomalies', () => {
  test('renders bucket tiles, table and anomaly side panel', async ({ page }) => {
    await page.goto('/dashboard/aging');
    await expect(
      page.getByRole('heading', { name: /What.s late, and what.s strange/i }),
    ).toBeVisible();
    for (const label of ['Within terms', '1–30 past', '31–60 past', '60+ past']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
    await expect(page.getByText(/By job —/)).toBeVisible();
    await expect(page.getByText(/What looks strange/i)).toBeVisible();
  });

  test('clicking a bucket filters the table', async ({ page }) => {
    await page.goto('/dashboard/aging?bucket=60-plus-past');
    // Filter clear link should appear when filter is active.
    await expect(page.getByRole('link', { name: /Clear filters/i })).toBeVisible();
  });
});
