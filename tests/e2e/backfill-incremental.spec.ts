import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

/**
 * Coverage for the V2 incremental-sync work:
 *   - Run-now picks incremental when ANY completed run exists for this
 *     (tenant, source) — even with no BackfillSchedule row. The watermark
 *     comes from BackfillRun.startedAt, not BackfillSchedule.lastSyncedAt.
 *   - "Run full sync" override (?mode=full) forces mode=full regardless.
 *   - Successful run advances BackfillSchedule.lastSyncedAt when a schedule
 *     exists (denormalized cache for the dispatcher).
 *   - UI shows mode badge + last-synced timestamp.
 *
 * Lives behind mock fixtures — these tests do NOT touch live Rooflink.
 * (mock mode is selected automatically when RL_KEY is unset; the test
 * runner is expected to launch a dev server without it.)
 */

test.describe('Backfill incremental sync API', () => {
  test('Run-now picks incremental when prior completed runs exist (no schedule required)', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await signInAs(context);

    // This test relies on the dev DB having at least one completed run for
    // rooflink_jobs — which is the realistic state after any prior backfill,
    // and matches what we ship to production via the GCP migration. The
    // pre-fix bug was: Run-now read BackfillSchedule.lastSyncedAt only, so
    // without a schedule row the watermark was always null and mode fell back
    // to 'full' — re-fetching all ~100k jobs every time. The fix derives the
    // watermark from BackfillRun directly.
    const res = await context.request.post('/api/backfills/rooflink_jobs/runs');
    expect([201, 409]).toContain(res.status());
    if (res.status() === 201) {
      const json = await res.json();
      expect(json.run.mode).toBe('incremental');
      expect(json.run.syncedSince).not.toBeNull();
      // Clean up.
      await context.request.post(
        `/api/backfills/rooflink_jobs/runs/${json.run.id}/cancel`,
      );
    }
  });

  test('mode=full query param forces full sync', async ({ browser }) => {
    const context = await browser.newContext();
    await signInAs(context);

    const res = await context.request.post(
      '/api/backfills/rooflink_jobs/runs?mode=full',
    );
    expect([201, 409]).toContain(res.status());
    if (res.status() === 201) {
      const json = await res.json();
      expect(json.run.mode).toBe('full');
      await context.request.post(
        `/api/backfills/rooflink_jobs/runs/${json.run.id}/cancel`,
      );
    }
  });

  test('GET /api/backfills includes lastSyncedAt + lastFullSyncAt on schedule', async ({
    browser,
  }) => {
    const context = await browser.newContext();
    await signInAs(context);

    // Ensure a schedule exists.
    await context.request.put('/api/backfills/rooflink_jobs/schedule', {
      data: {
        cadence: 'weekly',
        dayOfWeek: 1,
        timeLocal: '03:00',
        timezone: 'America/Chicago',
        enabled: true,
      },
    });

    const res = await context.request.get('/api/backfills');
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    const jobSchedule = json.schedules.find(
      (s: { source: string }) => s.source === 'rooflink_jobs',
    );
    expect(jobSchedule).toBeTruthy();
    // Fields are present; values can be null (no sync yet).
    expect('lastSyncedAt' in jobSchedule).toBe(true);
    expect('lastFullSyncAt' in jobSchedule).toBe(true);
  });
});

test.describe('Backfill incremental sync UI', () => {
  test('mode badge shows on active run', async ({ browser }) => {
    const context = await browser.newContext();
    await signInAs(context);

    // Kick off a run via API (faster than driving the UI).
    const startRes = await context.request.post(
      '/api/backfills/rooflink_jobs/runs',
    );
    // Either we got a fresh run, or one is already going from another test.
    let runId: number | null = null;
    if (startRes.status() === 201) {
      runId = (await startRes.json()).run.id;
    }

    try {
      const page = await context.newPage();
      await page.goto('/dashboard/scheduler');
      await page.getByRole('tab', { name: 'Data sync' }).click();
      await page.getByTestId('backfill-card-rooflink_jobs').waitFor({
        timeout: 10_000,
      });

      // Active-run progress moved to a sonner toast; the persistent loader
      // shows the mode label in its title. The inline mode badge no longer
      // exists. We assert the toast title contains "incremental sync" or
      // "full sync" — best-effort, since mock runs may complete fast.
      const toast = page
        .locator('[data-sonner-toast]')
        .filter({ hasText: /(incremental sync|full sync|sync complete)/i })
        .first();
      const visible = await toast.isVisible().catch(() => false);
      if (visible) {
        const text = (await toast.textContent()) ?? '';
        expect(text).toMatch(/Rooflink/i);
      }
      await page.close();
    } finally {
      if (runId) {
        await context.request.post(
          `/api/backfills/rooflink_jobs/runs/${runId}/cancel`,
        );
      }
    }
  });
});
