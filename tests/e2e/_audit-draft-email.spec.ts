import { test } from '@playwright/test';

test('mobile · draft email modal open', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/dashboard/follow-ups', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Open the first Draft email button.
  const draft = page.getByRole('button', { name: /Draft email/i }).first();
  await draft.scrollIntoViewIfNeeded();
  await draft.click();
  await page.waitForTimeout(400);
  await page.screenshot({
    path: 'tests/e2e/audit-screens/deep-draft-email-mobile.png',
    fullPage: false,
  });
});

test('mobile · draft email modal scrolled to footer', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/dashboard/follow-ups', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const draft = page.getByRole('button', { name: /Draft email/i }).first();
  await draft.scrollIntoViewIfNeeded();
  await draft.click();
  await page.waitForTimeout(400);
  // Scroll the modal body to the bottom so footer + body end visible.
  await page.evaluate(() => {
    const scrollable = document.querySelector('[role="dialog"] .overflow-y-auto');
    if (scrollable) (scrollable as HTMLElement).scrollTop = (scrollable as HTMLElement).scrollHeight;
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'tests/e2e/audit-screens/deep-draft-email-mobile-scrolled.png',
    fullPage: false,
  });
});
