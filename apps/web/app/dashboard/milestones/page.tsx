import type { Metadata } from 'next';
import { getData } from '@/lib/data';
import { MilestonesView } from './MilestonesView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Milestones' };

export default function MilestonesPage() {
  const { jobs } = getData();
  return <MilestonesView jobs={jobs} />;
}
