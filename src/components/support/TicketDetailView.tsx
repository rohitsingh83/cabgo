import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock, MapPin, Headset } from 'lucide-react';

import { PageHeader } from '@/components/shared/PageHeader';
import { TicketStatusBadge } from '@/components/support/TicketStatusBadge';
import { TICKET_CATEGORY_LABEL } from '@/lib/feedback';
import { formatDateTime } from '@/lib/utils';
import type { SupportTicketWithRide } from '@/types';

interface TicketDetailViewProps {
  ticket: SupportTicketWithRide;
  basePath: string;
  /** Where a related ride lives for this role (rider tracking page, driver ride page). */
  rideHref?: (rideId: string) => string;
}

/** Conversation-style view of one ticket: the user's message, then the support reply (or a waiting state). */
export function TicketDetailView({ ticket, basePath, rideHref }: TicketDetailViewProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={basePath} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All tickets
      </Link>

      <PageHeader title={ticket.subject} description={`${TICKET_CATEGORY_LABEL[ticket.category]} · opened ${formatDateTime(ticket.created_at)}`} className="mb-0" actions={<TicketStatusBadge status={ticket.status} />} />

      {ticket.ride && (
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Related ride · {formatDateTime(ticket.ride.created_at)}</p>
            <p className="truncate text-muted-foreground">
              {ticket.ride.pickup_address} → {ticket.ride.dropoff_address}
            </p>
          </div>
          {rideHref && (
            <Link href={rideHref(ticket.ride.id)} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-brand hover:underline">
              View
            </Link>
          )}
        </div>
      )}

      <section aria-label="Your message" className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">You wrote</p>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{ticket.description}</p>
      </section>

      {ticket.admin_response ? (
        <section aria-label="Support reply" className="rounded-2xl border border-brand/30 bg-brand/5 p-5">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <Headset className="h-4 w-4" aria-hidden /> CabGo support
          </p>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{ticket.admin_response}</p>
          {ticket.resolved_at && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Resolved {formatDateTime(ticket.resolved_at)}
            </p>
          )}
        </section>
      ) : (
        <section aria-label="Awaiting reply" className="flex items-start gap-3 rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{ticket.status === 'resolved' ? 'This ticket was closed without a written reply.' : 'We have your ticket. A member of our team will reply here — most tickets get an answer within a day.'}</p>
        </section>
      )}
    </div>
  );
}
