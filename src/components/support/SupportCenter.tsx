import Link from 'next/link';
import { ChevronDown, LifeBuoy, MessageSquareText, Phone, ShieldAlert } from 'lucide-react';

import { Reveal } from '@/components/shared/Reveal';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pager } from '@/components/shared/Pager';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { NewTicketDialog } from '@/components/support/NewTicketDialog';
import { TicketCard } from '@/components/support/TicketCard';
import { EMERGENCY_NUMBER } from '@/lib/feedback';
import { getRecentRidesForTicket, listTickets } from '@/lib/support/service';
import { ticketsQuerySchema } from '@/lib/validations';
import type { User } from '@/types';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
] as const;

const FAQ: Record<'rider' | 'driver', { q: string; a: string }[]> = {
  rider: [
    { q: 'How do cancellations and fees work?', a: 'Cancel for free within 2 minutes of booking. After that, or once a driver is close, a small cancellation fee may apply. You always see the exact amount before you confirm.' },
    { q: 'I was charged but my ride was cancelled', a: 'Failed or cancelled rides are refunded to your original payment method. Open a "Payment issue" ticket with the ride attached and we will check it.' },
    { q: 'I left something in the car', a: 'File a "Lost item" ticket and attach the ride. We pass your description to the driver and update you here.' },
    { q: 'How do I report unsafe driving?', a: 'Use SOS during a live trip if you feel unsafe. Afterwards, open a "Driver behaviour" ticket with the ride attached so our safety team can review it.' },
  ],
  driver: [
    { q: 'When do I get paid?', a: 'Each completed trip adds to your earnings after CabGo\'s commission. The Earnings page shows your totals by day, week and month.' },
    { q: 'A rider was disrespectful or unsafe', a: 'Use SOS during a live trip if you are in danger. Afterwards, file a "Driver behaviour" ticket with the ride attached and we will review it.' },
    { q: 'My documents were rejected', a: 'Open your Profile, re-upload clear, unexpired copies and save. Contact us here if the status does not change within two working days.' },
    { q: 'A fare looks wrong', a: 'Attach the ride to a "Payment issue" ticket and describe what you expected. We check the route and surge applied.' },
  ],
};

interface SupportCenterProps {
  user: User;
  /** `/rider/support` or `/driver/support`. */
  basePath: string;
  contactsHref: string;
  searchParams: { page?: string; status?: string };
}

/** The shared help hub for riders and drivers: ticket list + filters, FAQ and emergency shortcuts. */
export async function SupportCenter({ user, basePath, contactsHref, searchParams }: SupportCenterProps) {
  const parsed = ticketsQuerySchema.safeParse({ page: searchParams.page, status: searchParams.status });
  const query = parsed.success ? parsed.data : ticketsQuerySchema.parse({});

  const [tickets, rides] = await Promise.all([listTickets(user, query), getRecentRidesForTicket(user)]);
  const faq = FAQ[user.role === 'driver' ? 'driver' : 'rider'];

  const href = (status: string, page = 1) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return `${basePath}${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help & support"
        description="Raise an issue, track replies and find quick answers."
        className="mb-0"
        actions={<NewTicketDialog rides={rides} basePath={basePath} triggerClassName="w-full sm:w-auto" />}
      />

      <Reveal>
        <section aria-label="Emergency" className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-destructive text-white">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display font-extrabold">In an emergency?</p>
            <p className="text-sm text-muted-foreground">
              Call {EMERGENCY_NUMBER} straight away. During a live trip, use the SOS button on the trip screen to alert our safety team and your emergency contacts.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href={`tel:${EMERGENCY_NUMBER}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-destructive px-5 text-sm font-bold text-white hover:bg-destructive/90">
              <Phone className="h-4 w-4" aria-hidden /> Call {EMERGENCY_NUMBER}
            </a>
            <Link href={contactsHref} className="inline-flex h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold hover:bg-muted">
              Emergency contacts
            </Link>
          </div>
        </section>
      </Reveal>

      <Reveal delay={0.04}>
        <section aria-labelledby="tickets-heading" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="tickets-heading" className="font-display text-lg font-extrabold">
              Your tickets
            </h2>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <SegmentedLinks label="Filter tickets" items={FILTERS.map((f) => ({ label: f.label, href: href(f.value), active: f.value === query.status }))} />
            </div>
          </div>

          {tickets.items.length === 0 ? (
            <EmptyState
              icon={query.status === 'all' ? LifeBuoy : MessageSquareText}
              title={query.status === 'all' ? 'No tickets yet' : 'Nothing here'}
              description={query.status === 'all' ? 'When you need help, open a ticket and we will reply right here.' : 'No tickets match this filter.'}
              action={
                query.status === 'all' ? undefined : (
                  <Link href={basePath} className="inline-flex h-11 items-center rounded-xl border border-border px-5 text-sm font-semibold hover:bg-muted">
                    Show all
                  </Link>
                )
              }
            />
          ) : (
            <ul className="space-y-3">
              {tickets.items.map((ticket) => (
                <li key={ticket.id}>
                  <TicketCard ticket={ticket} href={`${basePath}/${ticket.id}`} />
                </li>
              ))}
            </ul>
          )}

          <Pager page={tickets.page} totalPages={tickets.totalPages} hrefFor={(page) => href(query.status, page)} />
        </section>
      </Reveal>

      <Reveal delay={0.08}>
        <section aria-labelledby="faq-heading" className="space-y-3">
          <h2 id="faq-heading" className="font-display text-lg font-extrabold">
            Quick answers
          </h2>
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {faq.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}
