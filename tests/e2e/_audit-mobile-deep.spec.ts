import { test } from '@playwright/test';

/**
 * Deep mobile audit (Wave 0). Captures interactive states at 375px so the
 * team can review *every* surface for responsiveness — not just landed-on
 * routes. Each test snapshots a single state; failures don't block other
 * captures (each test is independent).
 *
 * Coverage:
 *   - Modals / sheets opened (Ask-Me chat, JobDetailSheet)
 *   - Filter menu opened (per dashboard route)
 *   - Tab states (follow-ups: rep + queue)
 *   - Aging filter banner (default vs all-jobs)
 *   - Rep leaderboard metric variations
 *   - Scheduler: each row config visible
 *   - /docs scrolled into specific sections (heat / reports / out-of-scope)
 *   - / landing page scrolled
 *
 * Output: tests/e2e/audit-screens/deep-{name}.png
 */

const WIDTH = 375;
const HEIGHT = 900;

test.describe.configure({ mode: 'serial' });

async function setMobile(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: WIDTH, height: HEIGHT });
}

async function shot(page: import('@playwright/test').Page, name: string, fullPage = true) {
  await page.screenshot({
    path: `tests/e2e/audit-screens/deep-${name}.png`,
    fullPage,
  });
}

// --- Dashboard --------------------------------------------------------------

test('deep · dashboard · Ask Me modal open', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Ask Me/i }).click();
  await page.waitForTimeout(400);
  await shot(page, 'dashboard-askme-modal-open', false);
});

test('deep · dashboard · Ask Me modal with sample query', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Ask Me/i }).click();
  await page.waitForTimeout(400);
  const input = page.getByPlaceholder(/Ask me anything about AR/i);
  await input.fill('Who is the worst rep this week?');
  await shot(page, 'dashboard-askme-modal-typing', false);
});

// --- Aging ------------------------------------------------------------------

test('deep · aging · top of page', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/aging', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'aging-top');
});

test('deep · aging · all-jobs (no banner)', async ({ page }) => {
  await setMobile(page);
  // Clearing default past-terms filter via URL.
  await page.goto('/dashboard/aging?bucket=', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'aging-all-jobs');
});

test('deep · aging · filter menu open', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/aging', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Scroll filter into view, then open it.
  const filterButton = page.getByRole('button', { name: /^Filter/ }).first();
  await filterButton.scrollIntoViewIfNeeded();
  await filterButton.click();
  await page.waitForTimeout(300);
  await shot(page, 'aging-filter-open', false);
});

test('deep · aging · job detail sheet open', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/aging', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // First clickable table row.
  const firstRow = page.locator('tbody tr').first();
  await firstRow.scrollIntoViewIfNeeded();
  await firstRow.click();
  await page.waitForTimeout(400);
  await shot(page, 'aging-job-detail-open');
});

// --- Follow-ups -------------------------------------------------------------

test('deep · follow-ups · rep tab top', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/follow-ups', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'follow-ups-rep-top');
});

test('deep · follow-ups · executive review queue tab', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/follow-ups?tab=queue', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'follow-ups-queue-tab');
});

test('deep · follow-ups · after infinite scroll', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/follow-ups', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Force the IntersectionObserver to fire a few times by scrolling to bottom.
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
  }
  await shot(page, 'follow-ups-infinite-scrolled');
});

test('deep · follow-ups · filter menu open', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/follow-ups', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const filterButton = page.getByRole('button', { name: /^Filter/ }).first();
  await filterButton.scrollIntoViewIfNeeded();
  await filterButton.click();
  await page.waitForTimeout(300);
  await shot(page, 'follow-ups-filter-open', false);
});

// --- Milestones -------------------------------------------------------------

test('deep · milestones · top', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/milestones', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'milestones-top');
});

test('deep · milestones · job detail sheet open', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/milestones', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const firstRow = page.locator('tbody tr').first();
  await firstRow.scrollIntoViewIfNeeded();
  await firstRow.click();
  await page.waitForTimeout(400);
  await shot(page, 'milestones-job-detail-open');
});

// --- Reconciliation ---------------------------------------------------------

test('deep · reconciliation · top', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/reconciliation', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'reconciliation-top');
});

// --- Rep leaderboard --------------------------------------------------------

test('deep · rep-leaderboard · default (outstanding metric)', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/rep-leaderboard', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'leaderboard-outstanding');
});

const LEADERBOARD_METRICS = [
  'jobCount',
  'oldest',
  'avgHeat',
  'installValue',
  'commissions',
  'installCount',
];
for (const m of LEADERBOARD_METRICS) {
  test(`deep · rep-leaderboard · metric=${m}`, async ({ page }) => {
    await setMobile(page);
    await page.goto(`/dashboard/rep-leaderboard?metric=${m}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForTimeout(800);
    await shot(page, `leaderboard-${m}`);
  });
}

test('deep · rep-leaderboard · YTD period', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/rep-leaderboard?metric=installValue&period=ytd', {
    waitUntil: 'networkidle',
  });
  await page.waitForTimeout(800);
  await shot(page, 'leaderboard-installValue-ytd');
});

// --- Scheduler --------------------------------------------------------------

test('deep · scheduler · top', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/scheduler', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await shot(page, 'scheduler-top');
});

test('deep · scheduler · weekly row enabled', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/scheduler', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Toggle weekly row on so the day-of-week / time fields render.
  const weeklySwitch = page
    .locator('button[role="switch"][aria-label*="Weekly"]')
    .first();
  if (await weeklySwitch.isVisible().catch(() => false)) {
    await weeklySwitch.click();
    await page.waitForTimeout(300);
  }
  await shot(page, 'scheduler-weekly-enabled');
});

test('deep · scheduler · day-of-week select open', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/scheduler', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Open the day-of-week shadcn Select. Use its accessible name.
  const dayCombobox = page.getByRole('combobox', { name: /Day of week/i });
  if (await dayCombobox.isVisible().catch(() => false)) {
    await dayCombobox.click();
    await page.waitForTimeout(300);
  }
  await shot(page, 'scheduler-day-of-week-open', false);
});

test('deep · scheduler · day-of-month select open', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/scheduler', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const dayCombobox = page.getByRole('combobox', { name: /Day of month/i });
  if (await dayCombobox.isVisible().catch(() => false)) {
    await dayCombobox.click();
    await page.waitForTimeout(300);
  }
  await shot(page, 'scheduler-day-of-month-open', false);
});

test('deep · scheduler · email validation error visible', async ({ page }) => {
  await setMobile(page);
  await page.goto('/dashboard/scheduler', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.fill('not-an-email');
  await emailInput.blur();
  await page.waitForTimeout(200);
  await shot(page, 'scheduler-email-error');
});

// --- Long-form pages: scroll positions --------------------------------------
//
// fullPage screenshots already capture the entire document, but capturing
// at specific scroll Y values shows what the user actually sees in the
// viewport at that point — useful for catching sticky-header bugs and
// scrollspy state.

const LONG_FORM_ROUTES = [
  { path: '/', name: 'landing' },
  { path: '/docs', name: 'docs' },
  { path: '/design', name: 'design-system' },
];
const SCROLL_FRACTIONS = [
  { fraction: 0.25, label: 'q1' },
  { fraction: 0.5, label: 'mid' },
  { fraction: 0.75, label: 'q3' },
  { fraction: 1, label: 'bottom' },
];

for (const route of LONG_FORM_ROUTES) {
  for (const { fraction, label } of SCROLL_FRACTIONS) {
    test(`deep · ${route.name} · scrolled ${label}`, async ({ page }) => {
      await setMobile(page);
      await page.goto(route.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(800);
      await page.evaluate((f) => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, max * f);
      }, fraction);
      await page.waitForTimeout(400);
      await shot(page, `${route.name}-scroll-${label}`, false);
    });
  }
}

// --- Horizontal-overflow assertion (informational; doesn't fail audit) ------
//
// Logs which routes overflow horizontally at 375px. Becomes the
// regression check we'll wire as a hard assertion in Wave 5.

const OVERFLOW_ROUTES = [
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
for (const path of OVERFLOW_ROUTES) {
  test(`deep · overflow check · ${path}`, async ({ page }) => {
    await setMobile(page);
    await page.goto(path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const dims = await page.evaluate(() => ({
      docW: document.documentElement.scrollWidth,
      viewW: window.innerWidth,
    }));
    const overflows = dims.docW > dims.viewW;
    // eslint-disable-next-line no-console
    console.log(
      `[overflow] ${path}  docW=${dims.docW}  viewW=${dims.viewW}  ${overflows ? 'OVERFLOW' : 'ok'}`,
    );
  });
}
