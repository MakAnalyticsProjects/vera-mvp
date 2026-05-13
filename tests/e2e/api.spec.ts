import { expect, test } from '@playwright/test';
import { signInAs } from './_helpers/auth';

/**
 * Contract tests for the five metrics API endpoints. All routes now wrap in
 * `withAuth`, so requests need an authenticated cookie context — same
 * pattern as `backfill-api.spec.ts`.
 */

const ENDPOINTS = [
  '/api/jobs/aging',
  '/api/jobs/milestones',
  '/api/jobs/follow-ups',
  '/api/jobs/reconciliation',
  '/api/reps/outstanding',
];

test.describe('API endpoints', () => {
  for (const path of ENDPOINTS) {
    test(`${path} returns valid AR data`, async ({ browser }) => {
      const context = await browser.newContext();
      await signInAs(context);
      const res = await context.request.get(path);
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body).toBeTruthy();
      expect(body.asOf).toBeTruthy();
    });
  }

  test('/api/jobs/aging exposes bucket summary', async ({ browser }) => {
    const context = await browser.newContext();
    await signInAs(context);
    const res = await context.request.get('/api/jobs/aging');
    const body = await res.json();
    expect(body.bucketSummary).toHaveProperty('within-terms');
    expect(body.bucketSummary).toHaveProperty('60-plus-past');
    expect(typeof body.totalCount).toBe('number');
    expect(body.totalCount).toBeGreaterThan(0);
  });

  test('/api/reps/outstanding sorts by dollars by default', async ({ browser }) => {
    const context = await browser.newContext();
    await signInAs(context);
    const res = await context.request.get('/api/reps/outstanding');
    const body = await res.json();
    expect(Array.isArray(body.reps)).toBeTruthy();
    if (body.reps.length >= 2) {
      expect(body.reps[0].totalOutstanding).toBeGreaterThanOrEqual(body.reps[1].totalOutstanding);
    }
  });

  test('/api/jobs/follow-ups separates queue from follow-ups', async ({ browser }) => {
    const context = await browser.newContext();
    await signInAs(context);
    const res = await context.request.get('/api/jobs/follow-ups');
    const body = await res.json();
    expect(Array.isArray(body.followUps)).toBeTruthy();
    expect(Array.isArray(body.executiveQueue)).toBeTruthy();
    for (const j of body.executiveQueue) expect(j.heatBand).toBe('critical');
    for (const j of body.followUps) expect(j.heatBand).toBe('hot');
  });

  test('/api/jobs/aging returns 401 without a session', async ({ request }) => {
    const res = await request.get('/api/jobs/aging');
    expect(res.status()).toBe(401);
  });
});
