import { expect, test } from '@playwright/test';

/**
 * Production-only mobile-overflow regression. Ad-hoc spec — pointed at the
 * deployed URL via PLAYWRIGHT_PROD_URL. Asserts no horizontal page overflow
 * at 375px on every public route.
 */

const PROD = process.env.PLAYWRIGHT_PROD_URL ?? 'https://vera-mvp.vercel.app';

const ROUTES = [
  '/',
  '/docs',
  '/design',
  '/dashboard',
  '/dashboard/aging',
  '/dashboard/follow-ups',
  '/dashboard/milestones',
  '/dashboard/reconciliation',
  '/dashboard/rep-leaderboard',
  '/dashboard/scheduler',
];

for (const path of ROUTES) {
  test(`prod · 375px no overflow · ${path}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(`${PROD}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const dims = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      viewW: window.innerWidth,
    }));
    expect(dims.docW, `${path} document.scrollWidth must not exceed viewport`).toBeLessThanOrEqual(
      dims.viewW,
    );
  });
}
