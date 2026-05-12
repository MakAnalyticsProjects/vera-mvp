import type { Metadata } from 'next';
import { getData } from '@/lib/data';
import { AgingView } from './AgingView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Aging' };

export default function AgingPage() {
  const { jobs } = getData();
  return <AgingView jobs={jobs} />;
}
