import type { Metadata } from 'next';
import { getDataForCurrentSession } from '@/lib/data';
import { FollowUpsView } from './FollowUpsView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Follow-ups' };

export default async function FollowUpsPage() {
  const { jobs } = await getDataForCurrentSession();
  return <FollowUpsView jobs={jobs} />;
}
