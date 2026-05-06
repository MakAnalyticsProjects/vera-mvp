import { getData } from '@/lib/data';
import { MilestonesView } from './MilestonesView';

export const dynamic = 'force-dynamic';

export default function MilestonesPage() {
  const { jobs } = getData();
  return <MilestonesView jobs={jobs} />;
}
