import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

test.describe('Landing page', () => {
  test('renders hero, feature cards, and CTAs (anon shows "Sign in")', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Vera/);
    await expect(
      page.getByRole('heading', { name: /money that hasn.t come home yet/i }),
    ).toBeVisible();
    await expect(page.getByText('What I do, every morning')).toBeVisible();
    // Anonymous landing visitor — the primary CTA reads "Sign in" since
    // /dashboard is auth-gated. The signed-in version is covered below.
    await expect(
      page.getByRole('link', { name: /^Sign in$/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /Read how I work/i }),
    ).toBeVisible();
  });

  test('CTA navigates to the dashboard (signed-in user)', async ({ context, page }) => {
    // The dashboard is auth-gated — sign in so the CTA goes straight there
    // instead of bouncing through /login.
    await signInAs(context);
    await page.goto('/');
    await page
      .getByRole('link', { name: /Open the dashboard/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Today.s briefing/i })).toBeVisible();
  });

  test('Sign in CTA takes anonymous users to /login', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('link', { name: /^Sign in$/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login(\?callbackUrl=)?/);
  });

  test('Read how I work link navigates to /docs', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Read how I work/i }).click();
    await expect(page).toHaveURL(/\/docs$/);
    await expect(
      page.getByRole('heading', { name: /How I think, in detail/i }),
    ).toBeVisible();
  });
});
