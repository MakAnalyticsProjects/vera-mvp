import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

// Fixture: tests/fixtures/install-payments.fixture.json (Dallas, 2026-05, 49 rows).
// Balance Owed partitions into: 26 outstanding (> 0), 11 overpaid (< 0, credit due),
// 8 settled (≈ 0), 4 with no balance recorded. Sheet reviewed 05/11.
// Default order is most recent install first; the newest is Deanna McCorkle on
// 2026-05-29 and the earliest is Jason Nault on 2026-05-02.

test.describe('Installs & Payments', () => {
  test.beforeEach(async ({ context }) => {
    await signInAs(context);
  });

  test('renders header, narrative, and metric tiles', async ({ page }) => {
    await page.goto('/dashboard/installs');
    await expect(
      page.getByRole('heading', { name: /What was installed, what got paid/i }),
    ).toBeVisible();
    await expect(page.getByText('Contract value')).toBeVisible();
    await expect(page.getByText('Collected', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Outstanding', { exact: true }).first()).toBeVisible();
    // Sheet-level provenance line surfaces the "Last Reviewed" annotation.
    await expect(page.getByText(/Last reviewed 05\/11/i)).toBeVisible();
  });

  test('table shows the most recent install first with US-formatted date', async ({ page }) => {
    await page.goto('/dashboard/installs');
    await page.waitForLoadState('networkidle');
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow.locator('td').first()).toContainText('Deanna McCorkle');
    // Install date is rendered in a dedicated cell as MM/DD/YYYY.
    await expect(firstRow).toContainText(/05\/29\/2026/);
  });

  test('clicking a row opens the InstallDetailSheet with payments + source', async ({ page }) => {
    // Show all rows on one page (pageSize=50 > 49) so Jason Nault — now the
    // oldest install under the most-recent-first default — is on the first page.
    await page.goto('/dashboard/installs?pageSize=50');
    await page.waitForLoadState('networkidle');
    // Target Jason Nault's row explicitly so the assertion is independent of the
    // default sort order.
    await page.locator('table tbody tr', { hasText: 'Jason Nault' }).first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: /Payments received/i })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: /Source/i })).toBeVisible();
    await expect(sheet.getByText('Contract price')).toBeVisible();
    // Contract price for Jason Nault is $15,226 (formatUSD rounds to whole dollars).
    await expect(sheet.getByText('$15,226').first()).toBeVisible();
  });

  test('Status filter partitions rows into the four balance states', async ({ page }) => {
    const readRowCount = async (url: string): Promise<number> => {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      const title = await page
        .getByText(/Installs — \d+ rows?/)
        .first()
        .textContent();
      const match = title?.match(/(\d+)\s+rows?/);
      return Number(match?.[1] ?? '0');
    };

    const all = await readRowCount('/dashboard/installs');
    const outstanding = await readRowCount('/dashboard/installs?status=outstanding');
    const overpaid = await readRowCount('/dashboard/installs?status=overpaid');
    const settled = await readRowCount('/dashboard/installs?status=settled');
    const none = await readRowCount('/dashboard/installs?status=none');

    expect(all).toBe(49);
    expect(outstanding).toBe(26);
    expect(overpaid).toBe(11);
    expect(settled).toBe(8);
    expect(none).toBe(4);
    // The four mutually exclusive states partition every row exactly.
    expect(outstanding + overpaid + settled + none).toBe(all);
  });
});
