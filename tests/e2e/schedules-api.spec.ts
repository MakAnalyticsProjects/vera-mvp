import { expect, test, type APIResponse } from '@playwright/test';
import { signInAs } from './_helpers/auth';

/**
 * Round-trip coverage for /api/schedules. The full cron loop (dispatch
 * worker + Resend send) is tested end-to-end manually; this spec just
 * proves the API contract: auth gate, validation, persistence, and a
 * sane nextRunAt computation.
 */
test.describe('/api/schedules', () => {
  test('rejects unauthenticated requests with 401', async ({ request }) => {
    const post = await request.post('/api/schedules', {
      data: {
        cadence: 'daily',
        timeLocal: '08:00',
        timezone: 'America/Chicago',
        recipient: 'developer@levich.co',
      },
    });
    expect(post.status()).toBe(401);

    const get = await request.get('/api/schedules');
    expect(get.status()).toBe(401);
  });

  test('signed-in: POST creates schedule, GET returns it, nextRunAt is in the future', async ({
    browser,
  }) => {
    // We need a context with the signed-in cookie so request.* honours it.
    const context = await browser.newContext();
    await signInAs(context);

    const post = await context.request.post('/api/schedules', {
      data: {
        cadence: 'daily',
        timeLocal: '08:00',
        timezone: 'America/Chicago',
        recipient: 'developer@levich.co',
        enabled: true,
      },
    });
    expect(post.status()).toBe(201);
    const created = await readJson(post);

    expect(created.schedule).toMatchObject({
      cadence: 'daily',
      timeLocal: '08:00',
      timezone: 'America/Chicago',
      recipient: 'developer@levich.co',
      enabled: true,
      tenantId: 1,
    });
    const nextRunAt = new Date(created.schedule.nextRunAt);
    expect(nextRunAt.getTime()).toBeGreaterThan(Date.now());

    const get = await context.request.get('/api/schedules');
    expect(get.status()).toBe(200);
    const list = await readJson(get);
    const found = list.schedules.find((s: { id: number }) => s.id === created.schedule.id);
    expect(found).toBeTruthy();

    await context.close();
  });

  test('signed-in: rejects malformed input with 400', async ({ browser }) => {
    const context = await browser.newContext();
    await signInAs(context);

    const post = await context.request.post('/api/schedules', {
      data: {
        cadence: 'fortnightly', // not allowed
        timeLocal: '25:00',     // not a valid time
        timezone: '',
        recipient: 'not-an-email',
      },
    });
    expect(post.status()).toBe(400);

    await context.close();
  });
});

async function readJson(res: APIResponse) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (await res.json()) as any;
}
