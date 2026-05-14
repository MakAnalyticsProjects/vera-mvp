import type { Metadata } from 'next';
import { getDataForCurrentSession } from '@/lib/data';
import { MilestonesView } from './MilestonesView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Milestones' };

export default async function MilestonesPage() {
  const { jobs } = await getDataForCurrentSession();
  return <MilestonesView jobs={jobs} />;
}
