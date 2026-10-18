import type { Metadata } from 'next';

import { SettingsPanel } from '@/components/profile/SettingsPanel';
import { PageHeader } from '@/components/shared/PageHeader';
import { requireRole } from '@/lib/auth';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function DriverSettingsPage() {
  const user = await requireRole('driver');

  return (
    <div className="max-w-2xl">
      <PageHeader title="Settings" description="Appearance, account and security." />
      <SettingsPanel email={user.email} role={user.role} />
    </div>
  );
}
