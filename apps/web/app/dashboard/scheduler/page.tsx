import type { Metadata } from 'next';
import { SchedulerView } from './SchedulerView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Data sync' };

export default function SchedulerPage() {
  return <SchedulerView />;
}
