/**
 * Seeds the first tenant: Priority Roofs · Dallas. Idempotent — safe to run on
 * every deploy. Future tenants get added through the team-onboarding flow
 * (not yet built). Run via: `pnpm --filter @vera/web db:seed`.
 */
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const tenant = await db.tenant.upsert({
    where: { slug: 'priority-roofs-dallas' },
    update: {},
    create: {
      name: 'Priority Roofs · Dallas',
      slug: 'priority-roofs-dallas',
      senderDomain: 'makanalytics.org',
      brandColor: '#B85C2A',
      briefingTimeLocal: '07:00',
      briefingTimezone: 'America/Chicago',
    },
  });
  console.log('Seeded tenant:', tenant);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
