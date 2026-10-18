import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { TicketDetailView } from '@/components/support/TicketDetailView';
import { requireRole } from '@/lib/auth';
import { getTicket } from '@/lib/support/service';
import { uuidSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Support ticket' };
export const dynamic = 'force-dynamic';

export default async function DriverTicketPage({ params }: { params: { id: string } }) {
  const user = await requireRole('driver');
  // Malformed ids and other users' tickets are both a 404 (never reveal that a ticket exists).
  if (!uuidSchema.safeParse(params.id).success) notFound();
  const ticket = await getTicket(user, params.id);
  if (!ticket) notFound();

  return <TicketDetailView ticket={ticket} basePath="/driver/support" rideHref={(id) => `/driver/rides/${id}`} />;
}
