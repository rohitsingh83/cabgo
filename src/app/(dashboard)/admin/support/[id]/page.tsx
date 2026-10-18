import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, Headset, MapPin } from 'lucide-react';

import { RoleBadge } from '@/components/admin/AdminBadges';
import { AdminSection, BackLink } from '@/components/admin/AdminSection';
import { PersonCell } from '@/components/admin/PersonCell';
import { TicketReplyForm } from '@/components/admin/TicketReplyForm';
import { TicketStatusBadge } from '@/components/support/TicketStatusBadge';
import { getAdminTicket } from '@/lib/admin/support';
import { requireRole } from '@/lib/auth';
import { TICKET_CATEGORY_LABEL } from '@/lib/feedback';
import { formatDateTime } from '@/lib/utils';
import { uuidSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Support ticket' };
export const dynamic = 'force-dynamic';

export default async function AdminTicketPage({ params }: { params: { id: string } }) {
  await requireRole('admin');
  if (!uuidSchema.safeParse(params.id).success) notFound();
  const ticket = await getAdminTicket(params.id);
  if (!ticket) notFound();

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/admin/support">All tickets</BackLink>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="break-words font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{ticket.subject}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {TICKET_CATEGORY_LABEL[ticket.category]} · opened {formatDateTime(ticket.created_at)}
            </p>
          </div>
          <TicketStatusBadge status={ticket.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <AdminSection title="Customer message">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{ticket.description}</p>
          </AdminSection>

          {ticket.ride && (
            <Link href={`/admin/rides/${ticket.ride.id}`} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm transition-colors hover:border-brand/50">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">Related ride · {formatDateTime(ticket.ride.created_at)}</span>
                <span className="block truncate text-muted-foreground">
                  {ticket.ride.pickup_address} → {ticket.ride.dropoff_address}
                </span>
              </span>
              <span className="font-semibold text-brand">Open</span>
            </Link>
          )}

          {ticket.admin_response && (
            <section aria-label="Current reply" className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
                <Headset className="h-4 w-4" aria-hidden /> Last reply sent{ticket.resolver ? ` by ${ticket.resolver.full_name}` : ''}
              </p>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{ticket.admin_response}</p>
              {ticket.resolved_at && (
                <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Resolved {formatDateTime(ticket.resolved_at)}
                </p>
              )}
            </section>
          )}
        </div>

        <div className="space-y-6">
          <AdminSection title="Customer">
            {ticket.user ? (
              <Link href={`/admin/users/${ticket.user.id}`} className="-m-2 flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-muted/60">
                <PersonCell user={ticket.user} />
                <RoleBadge role={ticket.user.role} />
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">Account removed</p>
            )}
          </AdminSection>

          <AdminSection title="Respond">
            {/* Remounted per ticket revision so the form never shows stale values after a refresh. */}
            <TicketReplyForm key={`${ticket.id}-${ticket.updated_at}`} ticketId={ticket.id} status={ticket.status} existingResponse={ticket.admin_response} />
          </AdminSection>
        </div>
      </div>
    </div>
  );
}
