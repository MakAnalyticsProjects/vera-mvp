import type { Metadata } from 'next';
import { getData } from '@/lib/data';
import { ReconciliationView } from './ReconciliationView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Reconciliation' };

export default function ReconciliationPage() {
  const { jobs } = getData();
  return <ReconciliationView jobs={jobs} />;
}
