import { getData } from '@/lib/data';
import { jsonResponse } from '@/lib/api-helpers';
import { withAuth } from '@/lib/auth-helpers';

export async function GET() {
  return withAuth(async ({ tenantId }) => {
    const { jobs, asOf } = await getData(tenantId);
    const fellThrough = jobs
      .filter((j) => j.fellThroughCracks)
      .sort((a, b) => b.daysPastTerms - a.daysPastTerms);

    return jsonResponse({
      asOf,
      totalCount: fellThrough.length,
      totalBalance: fellThrough.reduce((s, j) => s + j.balance, 0),
      jobs: fellThrough,
    });
  });
}
