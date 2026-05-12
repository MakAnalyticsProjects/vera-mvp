import type { Metadata } from 'next';
import { getData } from '@/lib/data';
import { RepLeaderboardView } from './RepLeaderboardView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Rep leaderboard' };

export default function RepLeaderboardPage() {
  const data = getData();
  return <RepLeaderboardView jobs={data.jobs} reps={data.reps} asOf={data.asOf} />;
}
