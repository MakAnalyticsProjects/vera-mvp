import { test } from '@playwright/test';

const PROD = process.env.PLAYWRIGHT_PROD_URL ?? 'https://vera-mvp.vercel.app';

test('prod · dashboard at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${PROD}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/e2e/audit-screens/prod-dashboard-375.png', fullPage: true });
});

test('prod · dashboard at 1440px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${PROD}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/e2e/audit-screens/prod-dashboard-1440.png', fullPage: true });
});

test('prod · docs at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${PROD}/docs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/e2e/audit-screens/prod-docs-375.png', fullPage: true });
});

test('prod · scheduler at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto(`${PROD}/dashboard/scheduler`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/e2e/audit-screens/prod-scheduler-375.png', fullPage: true });
});
