import { test } from '@playwright/test';

/**
 * Mobile audit (Wave 0). Captures full-page screenshots of every route at three
 * viewport widths so the team can review the current mobile state before any
 * fixes are made. No assertions — pure visual capture.
 *
 * Output: tests/e2e/audit-screens/mobile-{route}-{width}.png
 */

const ROUTES = [
  { path: '/', name: 'landing' },
  { path: '/docs', name: 'docs' },
  { path: '/design', name: 'design-system' },
  { path: '/dashboard', name: 'dashboard-overview' },
  { path: '/dashboard/aging', name: 'aging' },
  { path: '/dashboard/aging?bucket=60-plus-past', name: 'aging-filtered' },
  { path: '/dashboard/follow-ups', name: 'follow-ups' },
  { path: '/dashboard/milestones', name: 'milestones' },
  { path: '/dashboard/reconciliation', name: 'reconciliation' },
  { path: '/dashboard/rep-leaderboard', name: 'rep-leaderboard' },
  { path: '/dashboard/scheduler', name: 'scheduler' },
];

const WIDTHS = [
  { width: 375, label: '375' }, // iPhone SE / 12 mini
  { width: 414, label: '414' }, // iPhone 11 Pro Max / Plus
  { width: 768, label: '768' }, // tablet — md breakpoint boundary
];

test.describe.configure({ mode: 'serial' });

for (const route of ROUTES) {
  for (const { width, label } of WIDTHS) {
    test(`mobile audit · ${route.name} · ${label}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route.path, { waitUntil: 'networkidle' });
      // Allow vera-rise / vera-modal-in animations to settle.
      await page.waitForTimeout(800);
      await page.screenshot({
        path: `tests/e2e/audit-screens/mobile-${route.name}-${label}.png`,
        fullPage: true,
      });
    });
  }
}
