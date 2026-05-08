import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

/**
 * Regression for the exit animations. Each spec:
 *   1. Opens a sheet/modal/drawer.
 *   2. Triggers close.
 *   3. Within ~150ms (well under the 220–240ms exit duration), asserts the
 *      element still exists in the DOM and carries the matching `-out`
 *      animation class.
 *   4. After the duration, asserts it's actually unmounted.
 *
 * If any of these fail, it means a component is snap-closing and skipped
 * the polish layer.
 */

test.describe('Exit animations', () => {
  test.beforeEach(async ({ context, page }) => {
    await signInAs(context);
    // Stop /api/chat from hitting the real endpoint.
    await page.route('**/api/chat', (route) =>
      route.fulfill({ status: 200, contentType: 'text/plain', body: '' }),
    );
  });

  test('Ask Me chat panel plays vera-modal-out on close', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Ask Me/i }).click();
    const dialog = page.getByRole('dialog', { name: /Chat with Vera/i });
    await expect(dialog).toBeVisible();

    const modal = dialog.locator('> div').first();
    await page.getByRole('button', { name: /Close chat/i }).click();

    // toHaveClass auto-retries until React's re-render commits the -out
    // class, but well before the 240ms exit timer unmounts it.
    await expect(modal, 'modal carries vera-modal-out mid-close').toHaveClass(
      /vera-modal-out/,
      { timeout: 200 },
    );
    await expect(dialog).toHaveCount(0);
  });

  test('MobileNav drawer plays vera-drawer-out on close', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: /Open navigation/i }).click();

    const drawer = page.getByRole('dialog', { name: /Navigation/i }).locator('aside');
    await expect(drawer).toBeVisible();

    await page.getByRole('button', { name: /Close navigation/i }).click();
    await expect(drawer, 'drawer carries vera-drawer-out mid-close').toHaveClass(
      /vera-drawer-out/,
      { timeout: 200 },
    );
    await expect(drawer).toHaveCount(0);
  });

  test('JobDetailSheet plays vera-sheet-out on close', async ({ page }) => {
    await page.goto('/dashboard/aging?buckets=60-plus-past');
    await page.waitForTimeout(800);
    await page.locator('table tbody tr').first().click();

    const sheet = page.getByRole('dialog').locator('aside');
    await expect(sheet).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sheet, 'sheet carries vera-sheet-out mid-close').toHaveClass(
      /vera-sheet-out/,
      { timeout: 200 },
    );
    await expect(sheet).toHaveCount(0);
  });
});
