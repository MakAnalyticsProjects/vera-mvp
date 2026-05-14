import type { Metadata } from 'next';
import { getDataForCurrentSession } from '@/lib/data';
import { AgingView } from './AgingView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Aging' };

export default async function AgingPage() {
  const { jobs } = await getDataForCurrentSession();
  return <AgingView jobs={jobs} />;
}
