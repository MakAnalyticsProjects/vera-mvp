import { getData } from '@/lib/data';
import { FollowUpsView } from './FollowUpsView';

export const dynamic = 'force-dynamic';

export default function FollowUpsPage() {
  const { jobs } = getData();
  return <FollowUpsView jobs={jobs} />;
}
