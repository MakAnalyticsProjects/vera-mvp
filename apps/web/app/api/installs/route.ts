import { z } from 'zod';
import { getInstallPayments } from '@/lib/install-payments-data';
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

    const file = await getInstallPayments(tenantId);
    let records = file.records;
    if (parsed.rep) records = records.filter((r) => r.salesRep === parsed.rep);

    const totals = records.reduce(
      (acc, r) => {
        acc.totalContractPrice += r.contractPrice ?? 0;
        acc.totalCollected +=
          (r.payment1 ?? 0) + (r.payment2 ?? 0) + (r.payment3 ?? 0) + (r.payment4 ?? 0);
        acc.totalBalanceOwed += r.balanceOwed ?? 0;
        return acc;
      },
      { rowCount: records.length, totalContractPrice: 0, totalCollected: 0, totalBalanceOwed: 0 },
    );

    return jsonResponse({
      generatedAt: file.generatedAt,
      region: file.region,
      sourcePeriod: file.sourcePeriod,
      reviewedLabel: file.reviewedLabel,
      clearingNote: file.clearingNote,
      totals,
      records,
    });
  });
}
