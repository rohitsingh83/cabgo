import Link from 'next/link';
import { ChevronRight, MessageSquareText } from 'lucide-react';

import { TicketStatusBadge } from '@/components/support/TicketStatusBadge';
import { TICKET_CATEGORY_LABEL } from '@/lib/feedback';
import { timeAgo } from '@/lib/utils';
import type { SupportTicketWithRide } from '@/types';

/** One row in the ticket list; the whole card is the link (≥ 44 px tall). */
export function TicketCard({ ticket, href }: { ticket: SupportTicketWithRide; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <MessageSquareText className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{ticket.subject}</p>
          <TicketStatusBadge status={ticket.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {TICKET_CATEGORY_LABEL[ticket.category]} · {timeAgo(ticket.created_at)}
          {ticket.admin_response ? ' · Reply from support' : ''}
        </p>
        {ticket.ride && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Ride: {ticket.ride.pickup_address} → {ticket.ride.dropoff_address}
          </p>
        )}
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
