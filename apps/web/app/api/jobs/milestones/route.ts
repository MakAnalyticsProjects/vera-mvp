import { z } from 'zod';
import { getData } from '@/lib/data';
import { jsonResponse, parseQuery } from '@/lib/api-helpers';
import { withAuth } from '@/lib/auth-helpers';

const QuerySchema = z.object({
  rep: z.string().optional(),
});

export async function GET(req: Request) {
  return withAuth(async ({ tenantId }) => {
    const url = new URL(req.url);
    const parsed = parseQuery(QuerySchema, url);
    if ('__error' in parsed) return parsed.__error;

    const { jobs, asOf } = await getData(tenantId);
    let filtered = jobs;
    if (parsed.rep) filtered = filtered.filter((j) => j.rep?.id?.toString() === parsed.rep);

    // Sort by number of missing milestones (desc), then by days since install (desc).
    const sorted = [...filtered].sort((a, b) => {
      if (b.missingMilestones.length !== a.missingMilestones.length) {
        return b.missingMilestones.length - a.missingMilestones.length;
      }
      return b.daysSinceInstall - a.daysSinceInstall;
    });

    return jsonResponse({
      asOf,
      totalCount: sorted.length,
      jobs: sorted,
    });
  });
}
