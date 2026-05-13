import type { Metadata } from 'next';
import { getDataForCurrentSession } from '@/lib/data';
import { RepLeaderboardView } from './RepLeaderboardView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Rep leaderboard' };

export default async function RepLeaderboardPage() {
  const data = await getDataForCurrentSession();
  return <RepLeaderboardView jobs={data.jobs} reps={data.reps} asOf={data.asOf} />;
}
