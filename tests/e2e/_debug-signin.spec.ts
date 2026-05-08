import { test } from '@playwright/test';
test('click sign in', async ({ page }) => {
  page.on('console', m => console.log('[browser]', m.type(), m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('domcontentloaded');
  console.log('On login page, URL:', page.url());
  const button = page.getByRole('button', { name: /Sign in with Google/i });
  await button.click({ noWaitAfter: true });
  await page.waitForTimeout(3000);
  console.log('After click, URL:', page.url());
  console.log('Page text snippet:', (await page.locator('body').textContent())?.slice(0, 300));
});
