import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

/**
 * Timezone rendering regression suite.
 *
 * The product rule is: dates flow over the wire as UTC ISO strings; the
 * browser converts them to the viewer's local timezone at the rendering
 * layer. Server-component formatting (`toLocaleDateString` called in a Node
 * handler) bakes the server's UTC date into the HTML before the browser ever
 * sees it — same string shown to every viewer regardless of their location.
 *
 * These tests pin the browser context to specific IANA zones and verify the
 * rendered surface reflects the configured timezone, not UTC. If a future
 * change re-introduces server-side date formatting, the Tokyo case (which
 * straddles the UTC date line for late-evening UTC times) flips and these
 * specs fail.
 */

const ZONES = [
  'America/Los_Angeles',
  'America/New_York',
  'Asia/Tokyo',
] as const;

test.describe('Intl.DateTimeFormat honors Playwright timezoneId', () => {
  // Confirms the test infrastructure itself — Playwright `timezoneId` makes
  // the browser report a different wall-clock for the same UTC instant. If
  // this fails, every other test in this file is meaningless.
  for (const tz of ZONES) {
    test(`runs in ${tz}`, async ({ browser }) => {
      const context = await browser.newContext({ timezoneId: tz });
      const page = await context.newPage();
      const resolved = await page.evaluate(
        () => Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      expect(resolved).toBe(tz);
      await context.close();
    });
  }
});

test.describe('Date.toLocaleDateString crosses the date line in Tokyo', () => {
  // A fixed UTC instant — late evening UTC on a Monday — falls on:
  //   - Monday in Pacific / Eastern / UTC itself
  //   - Tuesday in Tokyo (UTC+9 → already next morning)
  // If a date renders as Monday in Tokyo, it was formatted in some western
  // timezone (UTC or server-local) and the browser conversion never ran.
  const FIXED_UTC = '2026-05-18T23:00:00Z';

  for (const tz of ZONES) {
    test(`${tz}: produces the wall-clock weekday`, async ({ browser }) => {
      const context = await browser.newContext({ timezoneId: tz });
      const page = await context.newPage();
      const formatted = await page.evaluate((iso) => {
        return new Date(iso).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        });
      }, FIXED_UTC);

      if (tz === 'Asia/Tokyo') {
        expect(formatted).toContain('Tuesday');
        expect(formatted).toContain('May 19');
      } else {
        expect(formatted).toContain('Monday');
        expect(formatted).toContain('May 18');
      }
      await context.close();
    });
  }
});

test.describe('Dashboard "as of" header renders in browser timezone', () => {
  // The layout-level "Briefing for …" header used to format `asOf` in a
  // server component (Node runtime = UTC on Vercel), so every viewer saw
  // the UTC date. The fix moves formatting to a client component
  // (`AsOfDate.tsx`); rendered output must be a real human-readable date,
  // not the raw ISO YYYY-MM-DD fallback.
  for (const tz of ZONES) {
    test(`${tz}: header shows weekday + month + day`, async ({ browser }) => {
      const context = await browser.newContext({ timezoneId: tz });
      await signInAs(context);
      const page = await context.newPage();
      await page.goto('/dashboard');

      // The fixed banner sits in <header> and uses the display font class.
      // SSR briefly renders the YYYY-MM-DD fallback before client hydration
      // swaps in the formatted weekday string. Poll until the swap lands.
      const header = page.locator('header p.font-display').first();
      await expect(header).toBeVisible();
      await expect
        .poll(async () => (await header.textContent())?.trim() ?? '', {
          timeout: 5000,
        })
        .toMatch(
          /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),\s+\w+\s+\d{1,2}$/,
        );

      await context.close();
    });
  }
});

// NB: The audit log timestamp surface is already TZ-aware (AuditLogsView
// uses toLocaleString without an explicit timeZone). It's left out of this
// suite because its visible content depends on what other specs wrote to
// the audit table in the same run — too flaky against the shared test DB.
// If audit-log rendering ever regresses, audit-logs.spec.ts is the right
// place to lock it in.
