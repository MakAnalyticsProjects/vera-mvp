import { getData } from '@/lib/data';
import { ReconciliationView } from './ReconciliationView';

export const dynamic = 'force-dynamic';

export default function ReconciliationPage() {
  const { jobs } = getData();
  return <ReconciliationView jobs={jobs} />;
}
