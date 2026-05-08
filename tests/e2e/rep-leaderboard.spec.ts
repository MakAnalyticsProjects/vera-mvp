import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

test.describe('Rep leaderboard', () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context);
  });

  test('renders leaderboard, top-10 chart, and metric tiles', async ({ page }) => {
    await page.goto('/dashboard/rep-leaderboard');
    await expect(
      page.getByRole('heading', { name: /Where the money is by rep/i }),
    ).toBeVisible();
    await expect(page.getByText('Reps with AR')).toBeVisible();
    await expect(page.getByText(/Top 10 reps by/)).toBeVisible();
    await expect(page.getByText(/Leaderboard —/i).first()).toBeVisible();
  });

  test('clicking a metric chip updates the URL', async ({ page }) => {
    await page.goto('/dashboard/rep-leaderboard');
    await page.getByRole('button', { name: 'Average heat', exact: true }).click();
    await expect(page).toHaveURL(/metric=avgHeat/);
  });

  test('changing period updates the URL', async ({ page }) => {
    await page.goto('/dashboard/rep-leaderboard?metric=installValue');
    await page.getByRole('button', { name: 'Last 30 days', exact: true }).click();
    await expect(page).toHaveURL(/period=30d/);
  });

  test('MTD and YTD lead the period selector', async ({ page }) => {
    await page.goto('/dashboard/rep-leaderboard?metric=installValue');
    const mtdBtn = page.getByRole('button', { name: 'MTD', exact: true });
    const ytdBtn = page.getByRole('button', { name: 'YTD', exact: true });
    await expect(mtdBtn).toBeVisible();
    await expect(ytdBtn).toBeVisible();

    await ytdBtn.click();
    await expect(page).toHaveURL(/period=ytd/);

    await mtdBtn.click();
    await expect(page).toHaveURL(/period=mtd/);
  });
});
