import { expect, test } from '@playwright/test';

test.describe('Milestones report', () => {
  test('renders header, narrative, and metric tiles', async ({ page }) => {
    await page.goto('/dashboard/milestones');
    await expect(
      page.getByRole('heading', { name: /Where each install actually stands/i }),
    ).toBeVisible();
    await expect(page.getByText('Missing cert of completion')).toBeVisible();
    await expect(page.getByText(/Insurance — final check open/)).toBeVisible();
  });

  test('shows missing-step tags for at least one job', async ({ page }) => {
    await page.goto('/dashboard/milestones');
    // The fixture has many jobs missing cert/final-check/commission tags.
    await expect(page.getByText(/missing:/i).first()).toBeVisible();
  });

  test('clicking a row opens the JobDetailSheet', async ({ page }) => {
    await page.goto('/dashboard/milestones');
    await page.waitForTimeout(800);
    await page.locator('table tbody tr').first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: /Install.+terms/i })).toBeVisible();
  });
});
