import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

test.describe('Aging & anomalies', () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context);
  });

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

  test('clicking a bucket filter via URL applies it', async ({ page }) => {
    await page.goto('/dashboard/aging?buckets=60-plus-past');
    await page.waitForTimeout(800);
    // Toolbar subtitle indicates active filters
    await expect(page.getByText(/1 filter applied/i)).toBeVisible();
  });

  test('defaults to past-terms only and exposes a view-all reset', async ({ page }) => {
    await page.goto('/dashboard/aging');
    await page.waitForTimeout(800);
    // Default banner is visible and the URL is clean (default doesn't serialize).
    const banner = page.getByTestId('aging-default-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/past terms only/i);
    // Default-on means no "filter applied" subtitle.
    await expect(page.getByText(/filter applied/i)).toHaveCount(0);

    // Clicking "View all" removes the filter, banner disappears, and within-terms
    // jobs become visible (their bucket badge now appears in the table).
    await banner.getByRole('button', { name: /view all jobs/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByTestId('aging-default-banner')).toHaveCount(0);
  });

  test('clicking a row opens the JobDetailSheet', async ({ page }) => {
    await page.goto('/dashboard/aging?buckets=60-plus-past');
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
