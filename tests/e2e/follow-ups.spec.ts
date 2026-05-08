import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

test.describe('Follow-ups & executive review', () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context);
  });

  test('renders both tabs and metric tiles', async ({ page }) => {
    await page.goto('/dashboard/follow-ups');
    await expect(
      page.getByRole('heading', { name: /Who I.d nudge today/i }),
    ).toBeVisible();
    await expect(page.getByText(/Hot — for reps/)).toBeVisible();
    await expect(page.getByText(/Critical — exec review/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Rep follow-ups/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Executive review queue/ })).toBeVisible();
  });

  test('switches to the executive queue tab', async ({ page }) => {
    await page.goto('/dashboard/follow-ups');
    await page.getByRole('button', { name: /Executive review queue/ }).click();
    await expect(page).toHaveURL(/tab=queue/);
  });

  test('opens a draft email modal', async ({ page }) => {
    await page.goto('/dashboard/follow-ups');
    const draftButton = page.getByRole('button', { name: 'Draft email' }).first();
    if (await draftButton.isVisible().catch(() => false)) {
      await draftButton.click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/Subject/)).toBeVisible();
      await expect(page.getByRole('button', { name: /Copy to clipboard/i })).toBeVisible();
      await page.getByRole('button', { name: /Close/i }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
});
