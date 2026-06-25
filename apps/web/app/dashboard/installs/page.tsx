import type { Metadata } from 'next';
import { getInstallPaymentsForCurrentSession } from '@/lib/install-payments-data';
import { InstallsView } from './InstallsView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Installs & Payments' };

export default async function InstallsPage() {
  const file = await getInstallPaymentsForCurrentSession();
  return <InstallsView file={file} />;
}
