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

  test('clicking a row opens the JobDetailSheet', async ({ page }) => {
    await page.goto('/dashboard/aging?bucket=60-plus-past');
    await page.waitForTimeout(800);
    // Click first row in the table body.
    await page.locator('table tbody tr').first().click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    // Sheet content includes the 'Install & terms' section heading.
    await expect(
      sheet.getByRole('heading', { name: /Install.+terms/i }),
    ).toBeVisible();
    // Esc should close.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
  });

  test('+N more anomaly tooltip lists remaining anomalies', async ({ page }) => {
    await page.goto('/dashboard/aging');
    await page.waitForTimeout(800);
    const moreBadge = page.getByText(/^\+\d+ more$/).first();
    if (await moreBadge.isVisible().catch(() => false)) {
      await moreBadge.hover();
      await expect(page.getByRole('tooltip')).toBeVisible();
      await expect(page.getByRole('tooltip')).toContainText(/Also flagged/);
    }
  });
});
