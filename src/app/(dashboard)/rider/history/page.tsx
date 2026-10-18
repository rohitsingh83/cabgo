import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckCircle2, History, Route, SearchX, XCircle } from 'lucide-react';

import { HistoryFilters } from '@/components/ride/HistoryFilters';
import { RideCard } from '@/components/ride/RideCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pager } from '@/components/shared/Pager';
import { Reveal } from '@/components/shared/Reveal';
import { buttonVariants } from '@/components/ui/button';
import { requireRole } from '@/lib/auth';
import { getRiderHistorySummary, listRiderHistory } from '@/lib/rides/history';
import { RATING_WINDOW_DAYS } from '@/lib/ratings/service';
import { formatDistance } from '@/lib/utils';
import { historyQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Your trips' };
export const dynamic = 'force-dynamic';

interface HistorySearchParams {
  page?: string;
  status?: string;
  range?: string;
  q?: string;
}

export default async function RiderHistoryPage({ searchParams }: { searchParams: HistorySearchParams }) {
  const user = await requireRole('rider');
  // Hand-edited or stale query strings fall back to the defaults instead of crashing the page.
  const parsed = historyQuerySchema.safeParse(searchParams);
  const query = parsed.success ? parsed.data : historyQuerySchema.parse({});

  const [history, summary] = await Promise.all([listRiderHistory(user.id, query), getRiderHistorySummary(user.id)]);

  const hrefFor = (next: { status?: string; range?: string; q?: string | null; page?: number }) => {
    const status = next.status ?? query.status;
    const range = next.range ?? query.range;
    const q = next.q === null ? undefined : next.q ?? query.q;
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (range !== 'all') params.set('range', range);
    if (q) params.set('q', q);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    const qs = params.toString();
    return `/rider/history${qs ? `?${qs}` : ''}`;
  };

  const filtered = query.status !== 'all' || query.range !== 'all' || Boolean(query.q);
  const ratingWindowMs = RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const tiles = [
    { label: 'Completed trips', value: summary.completed.toLocaleString('en-IN'), icon: CheckCircle2, tone: 'bg-success/10 text-success' },
    { label: 'Distance travelled', value: formatDistance(summary.distanceKm), icon: Route, tone: 'bg-brand/10 text-brand' },
    { label: 'Cancelled', value: summary.cancelled.toLocaleString('en-IN'), icon: XCircle, tone: 'bg-muted text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Your trips" description="Every ride you've taken, with receipts and ratings." className="mb-0" />

      <Reveal>
        <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiles.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-2xl font-extrabold tabular-nums">{value}</p>
                <p className="truncate text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </section>
      </Reveal>

      <Reveal delay={0.04}>
        <HistoryFilters status={query.status} range={query.range} q={query.q} hrefFor={hrefFor} />
      </Reveal>

      <Reveal delay={0.08}>
        <section aria-label="Trips" className="space-y-4">
          {history.items.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="No trips match"
                description="Try a different search or widen the date range."
                action={
                  <Link href="/rider/history" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <EmptyState
                icon={History}
                title="No trips yet"
                description="Your completed and cancelled rides will appear here."
                action={
                  <Link href="/rider/book" className={buttonVariants({ variant: 'brand', size: 'lg' })}>
                    Book your first ride
                  </Link>
                }
              />
            )
          ) : (
            <>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {history.total.toLocaleString('en-IN')} trip{history.total === 1 ? '' : 's'}
                {filtered ? ' found' : ''}
              </p>
              <ul className="space-y-3">
                {history.items.map((ride) => (
                  <li key={ride.id}>
                    <RideCard
                      ride={ride}
                      meta={{
                        paymentStatus: ride.payment_status,
                        rating: ride.my_rating,
                        canRate: ride.status === 'completed' && ride.my_rating === null && Boolean(ride.driver_id) && now - new Date(ride.completed_at ?? ride.updated_at).getTime() <= ratingWindowMs,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}

          <Pager page={history.page} totalPages={history.totalPages} hrefFor={(page) => hrefFor({ page })} />
        </section>
      </Reveal>
    </div>
  );
}
