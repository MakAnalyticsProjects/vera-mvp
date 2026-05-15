#!/bin/bash
# LiveJob deploy smoke — capture AR + write-offs totals from prod.
#
# The LiveJob migration is read-equivalent (no behavior change for end users),
# so the totals captured BEFORE the deploy must match the totals AFTER.
#
# Usage:
#   # Before deploy:
#   bash scripts/smoke-livejob-totals.sh > /tmp/livejob-totals-before.json
#
#   # After deploy:
#   bash scripts/smoke-livejob-totals.sh > /tmp/livejob-totals-after.json
#   diff /tmp/livejob-totals-before.json /tmp/livejob-totals-after.json
#
# Expects:
#   PROD_BASE_URL  (default: https://vera-mvp.vercel.app)
#   AUTH_SECRET    (read from .env.prod if not set)
#
# Read-only. Hits public auth endpoint to mint a session, then GETs dashboard APIs.

set -e

BASE_URL="${PROD_BASE_URL:-https://vera-mvp.vercel.app}"

if [ -z "$AUTH_SECRET" ]; then
  if [ -f .env.prod ]; then
    AUTH_SECRET="$(grep -E '^(AUTH_SECRET|NEXTAUTH_SECRET)=' .env.prod | head -1 | cut -d= -f2- | tr -d '\"')"
  fi
fi
if [ -z "$AUTH_SECRET" ]; then
  echo "ERROR: AUTH_SECRET not set and not found in .env.prod" >&2
  exit 1
fi

# Mint a session cookie via @auth/core JWT encode. Uses the same shape the
# Playwright auth helper uses (tests/e2e/_helpers/auth.ts).
TOKEN="$(AUTH_SECRET="$AUTH_SECRET" node -e '
const { encode } = require("@auth/core/jwt");
(async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = await encode({
    secret: process.env.AUTH_SECRET,
    salt: "authjs.session-token",
    token: {
      name: "Smoke Test", email: "adityauphade@makanalytics.org",
      sub: "1", userId: 1, tenantId: 1, role: "owner",
      iat: now, exp: now + 600, jti: `smoke-${now}`,
    },
  });
  process.stdout.write(token);
})();
')"

# Use a sane cookie name for HTTP vs HTTPS.
if [[ "$BASE_URL" == https://* ]]; then
  COOKIE_NAME="__Secure-authjs.session-token"
else
  COOKIE_NAME="authjs.session-token"
fi

fetch_json () {
  curl -sS -H "Cookie: $COOKIE_NAME=$TOKEN" "$BASE_URL$1"
}

# Capture totals. JSON output for easy diff.
node -e "
const json = (s) => JSON.parse(s);
(async () => {
  const fetchUrl = async (path) => {
    const res = await fetch('$BASE_URL' + path, {
      headers: { Cookie: '$COOKIE_NAME=$TOKEN' },
    });
    return { status: res.status, body: res.ok ? await res.json() : null };
  };

  const aging        = await fetchUrl('/api/jobs/aging');
  const followUps    = await fetchUrl('/api/jobs/follow-ups');
  const milestones   = await fetchUrl('/api/jobs/milestones');
  const reconciliation = await fetchUrl('/api/jobs/reconciliation');
  const reps         = await fetchUrl('/api/reps/outstanding');
  const schedules    = await fetchUrl('/api/schedules');

  const out = {
    when: new Date().toISOString(),
    base: '$BASE_URL',
    aging: {
      status: aging.status,
      totalCount: aging.body?.totalCount,
      totalBalance: aging.body?.totalBalance,
      bucketCounts: aging.body?.bucketSummary && Object.fromEntries(
        Object.entries(aging.body.bucketSummary).map(([k, v]) => [k, v.count])
      ),
      bucketTotals: aging.body?.bucketSummary && Object.fromEntries(
        Object.entries(aging.body.bucketSummary).map(([k, v]) => [k, Number(v.total).toFixed(2)])
      ),
      anomalyCounts: aging.body?.anomalySummary,
    },
    followUps:     { status: followUps.status, totalCount: followUps.body?.totalCount },
    milestones:    { status: milestones.status, totalCount: milestones.body?.totalCount },
    reconciliation:{ status: reconciliation.status, totalCount: reconciliation.body?.totalCount },
    reps:          { status: reps.status, repCount: reps.body?.reps?.length },
    schedules:     { status: schedules.status, count: schedules.body?.schedules?.length },
  };
  process.stdout.write(JSON.stringify(out, null, 2));
})();
"
