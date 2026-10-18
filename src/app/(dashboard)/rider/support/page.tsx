import type { Metadata } from 'next';

import { SupportCenter } from '@/components/support/SupportCenter';
import { requireRole } from '@/lib/auth';

export const metadata: Metadata = { title: 'Help & support' };
export const dynamic = 'force-dynamic';

export default async function RiderSupportPage({ searchParams }: { searchParams: { page?: string; status?: string } }) {
  const user = await requireRole('rider');
  return <SupportCenter user={user} basePath="/rider/support" contactsHref="/rider/profile#emergency-contacts" searchParams={searchParams} />;
}
