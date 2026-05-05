import { expect, test } from '@playwright/test';

test.describe('Landing page', () => {
  test('renders Vera intro and key copy', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Vera/);
    await expect(page.getByText('Vera Calloway', { exact: false })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Lead AR Intelligence Specialist/i }),
    ).toBeVisible();
  });
});
