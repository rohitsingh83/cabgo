import type { Metadata } from 'next';

import { SupportCenter } from '@/components/support/SupportCenter';
import { requireRole } from '@/lib/auth';

export const metadata: Metadata = { title: 'Help & support' };
export const dynamic = 'force-dynamic';

export default async function DriverSupportPage({ searchParams }: { searchParams: { page?: string; status?: string } }) {
  const user = await requireRole('driver');
  return <SupportCenter user={user} basePath="/driver/support" contactsHref="/driver/profile#emergency-contacts" searchParams={searchParams} />;
}
