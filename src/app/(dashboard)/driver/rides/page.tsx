import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Route as RouteIcon } from 'lucide-react';

import { RideCard } from '@/components/ride/RideCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { buttonVariants } from '@/components/ui/button';
import { PAGE_SIZE } from '@/lib/constants';
import { requireDriverWithProfile } from '@/lib/drivers/guard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { cn } from '@/lib/utils';
import { driverRidesQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Rides' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export default async function DriverRidesPage({ searchParams }: { searchParams: { page?: string; status?: string } }) {
  const { user } = await requireDriverWithProfile();
  const { page, status } = driverRidesQuerySchema.parse({ page: searchParams.page, status: searchParams.status });

  const db = createSupabaseAdminClient();
  let query = db
    .from('rides')
    .select('*', { count: 'exact' })
    .eq('driver_id', user.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status !== 'all') query = query.eq('status', status);

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to load rides: ${error.message}`);

  const rides = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const href = (nextPage: number, nextStatus = status) => {
    const params = new URLSearchParams();
    if (nextStatus !== 'all') params.set('status', nextStatus);
    if (nextPage > 1) params.set('page', String(nextPage));
    const qs = params.toString();
    return `/driver/rides${qs ? `?${qs}` : ''}`;
  };

  return (
    <div>
      <PageHeader
        title="Your rides"
        description={`${count ?? 0} trip${count === 1 ? '' : 's'} so far.`}
        actions={<SegmentedLinks label="Filter rides" items={FILTERS.map((f) => ({ label: f.label, href: href(1, f.value), active: status === f.value }))} />}
      />

      {rides.length === 0 ? (
        <EmptyState
          icon={RouteIcon}
          title={status === 'all' ? 'No trips yet' : `No ${status} trips`}
          description="Go online from your dashboard to start receiving ride requests."
          action={
            <Link href="/driver" className={buttonVariants({ variant: 'brand', size: 'lg' })}>
              Go to dashboard
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rides.map((ride) => (
            <RideCard key={ride.id} ride={ride} href={`/driver/rides/${ride.id}`} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
          <Link
            href={href(page - 1)}
            aria-disabled={page <= 1}
            tabIndex={page <= 1 ? -1 : undefined}
            className={cn(buttonVariants({ variant: 'outline' }), page <= 1 && 'pointer-events-none opacity-50')}
          >
            <ChevronLeft aria-hidden /> Previous
          </Link>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Link
            href={href(page + 1)}
            aria-disabled={page >= totalPages}
            tabIndex={page >= totalPages ? -1 : undefined}
            className={cn(buttonVariants({ variant: 'outline' }), page >= totalPages && 'pointer-events-none opacity-50')}
          >
            Next <ChevronRight aria-hidden />
          </Link>
        </nav>
      )}
    </div>
  );
}
