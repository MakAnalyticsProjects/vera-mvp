import type { Metadata } from 'next';
import { AuditLogsView } from './AuditLogsView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Audit log' };

export default function AuditLogsPage() {
  return <AuditLogsView />;
}
