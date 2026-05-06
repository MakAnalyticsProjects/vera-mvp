import { getData } from '@/lib/data';
import { AgingView } from './AgingView';

export const dynamic = 'force-dynamic';

export default function AgingPage() {
  const { jobs } = getData();
  return <AgingView jobs={jobs} />;
}
