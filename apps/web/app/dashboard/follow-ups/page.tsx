import type { Metadata } from 'next';
import { getData } from '@/lib/data';
import { FollowUpsView } from './FollowUpsView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Follow-ups' };

export default function FollowUpsPage() {
  const { jobs } = getData();
  return <FollowUpsView jobs={jobs} />;
}
