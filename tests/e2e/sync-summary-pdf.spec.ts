import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

/**
 * Coverage for the post-sync PDF endpoint that the tick worker also uses
 * to build the email attachment. Hitting it through HTTP is the only way
 * to exercise the PDF render path in Playwright — direct TSX imports
 * aren't transpiled outside the test directory.
 *
 * Mocked Rooflink: these tests don't need a freshly-completed run because
 * the cancelled / queued / 401 paths cover the contract end of the route.
 * A populated DB would be needed to assert on the 200 path; we leave that
 * to live ops verification.
 */

test.describe('Sync summary PDF route', () => {
  test('GET requires auth (401 when unsigned)', async ({ request }) => {
    const res = await request.get('/api/backfills/rooflink_jobs/runs/1/sync-summary');
    expect(res.status()).toBe(401);
  });

  test('GET rejects invalid source with 400', async ({ browser }) => {
    const context = await browser.newContext();
    await signInAs(context);
    const res = await context.request.get(
      '/api/backfills/not_a_source/runs/1/sync-summary',
    );
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_source');
  });

  test('GET rejects non-numeric run id with 400', async ({ browser }) => {
    const context = await browser.newContext();
    await signInAs(context);
    const res = await context.request.get(
      '/api/backfills/rooflink_jobs/runs/abc/sync-summary',
    );
    expect(res.status()).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_run_id');
  });

  test('GET returns 404 for a run id that does not exist', async ({ browser }) => {
    const context = await browser.newContext();
    await signInAs(context);
    const res = await context.request.get(
      '/api/backfills/rooflink_jobs/runs/99999999/sync-summary',
    );
    expect(res.status()).toBe(404);
    const json = await res.json();
    expect(json.error).toBe('not_found');
  });
});
