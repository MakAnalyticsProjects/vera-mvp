import type { Metadata } from 'next';
import { getWriteOffsForCurrentSession } from '@/lib/write-offs-data';
import { WriteOffsView } from './WriteOffsView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Write-offs' };

export default async function WriteOffsPage() {
  const file = await getWriteOffsForCurrentSession();
  return <WriteOffsView file={file} />;
}
