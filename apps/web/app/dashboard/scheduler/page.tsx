import type { Metadata } from 'next';
import { SchedulerView } from './SchedulerView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Scheduler' };

export default function SchedulerPage() {
  return <SchedulerView />;
}
