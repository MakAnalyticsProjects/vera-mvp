import type { Metadata } from 'next';
import { getDataForCurrentSession } from '@/lib/data';
import { ReconciliationView } from './ReconciliationView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reconciliation' };

export default async function ReconciliationPage() {
  const { jobs } = await getDataForCurrentSession();
  return <ReconciliationView jobs={jobs} />;
}
