import type { Metadata } from 'next';
import { Route } from 'lucide-react';

import { AdminSearch, buildHref, FilterRow } from '@/components/admin/AdminToolbar';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ExportButton } from '@/components/admin/ExportButton';
import { PersonCell } from '@/components/admin/PersonCell';
import { PaymentStatusBadge } from '@/components/payment/PaymentStatusBadge';
import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pager } from '@/components/shared/Pager';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { listAdminRides, type AdminRideRow } from '@/lib/admin/rides';
import { parseSearchParams } from '@/lib/admin/search-params';
import { requireRole } from '@/lib/auth';
import { VEHICLES } from '@/lib/constants';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { adminRidesQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Rides' };
export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;
const RANGES = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All time' },
] as const;

const COLUMNS: Column<AdminRideRow>[] = [
  {
    key: 'route',
    header: 'Ride',
    cell: (ride) => (
      <span className="block min-w-0 max-w-xs">
        <span className="block truncate text-sm">
          {ride.pickup_address} → {ride.dropoff_address}
        </span>
        <span className="block text-xs font-normal text-muted-foreground">
          {formatDateTime(ride.created_at)} · {VEHICLES[ride.ride_type].label}
        </span>
      </span>
    ),
  },
  { key: 'rider', header: 'Rider', cell: (ride) => <PersonCell user={ride.rider} showContact={false} /> },
  { key: 'driver', header: 'Driver', cell: (ride) => <PersonCell user={ride.driver} showContact={false} fallback="Unassigned" /> },
  { key: 'status', header: 'Status', cell: (ride) => <RideStatusBadge status={ride.status} /> },
  { key: 'payment', header: 'Payment', cell: (ride) => (ride.payment_status ? <PaymentStatusBadge status={ride.payment_status} /> : <span className="text-muted-foreground">—</span>), hideOnMobile: true },
  { key: 'fare', header: 'Fare', align: 'right', cell: (ride) => <span className="font-semibold">{formatCurrency(Number(ride.final_fare ?? ride.estimated_fare))}</span> },
];

export default async function AdminRidesPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireRole('admin');
  const query = parseSearchParams(adminRidesQuerySchema, searchParams);
  const result = await listAdminRides(query);

  const defaults = { status: 'all', range: 'all' };
  const href = (patch: Partial<typeof query>) => buildHref('/admin/rides', { ...query, ...patch, page: patch.page ?? 1 }, defaults);
  // A status chosen via a deep link (e.g. "searching") has no tab of its own; keep the tabs honest.
  const statusTabs = STATUSES.some((s) => s.value === query.status) ? STATUSES : [...STATUSES, { value: query.status, label: query.status.replace('_', ' ') }];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rides"
        description={`${result.total.toLocaleString('en-IN')} ride${result.total === 1 ? '' : 's'} match your filters.`}
        className="mb-0"
        actions={<ExportButton type="rides" range={query.range} status={query.status} />}
      />

      <FilterRow>
        <AdminSearch action="/admin/rides" placeholder="Search pickup or drop-off address" q={query.q} keep={{ status: query.status === 'all' ? undefined : query.status, range: query.range === 'all' ? undefined : query.range }} clearHref={href({ q: undefined })} />
        <SegmentedLinks label="Status" items={statusTabs.map((s) => ({ label: s.label, href: href({ status: s.value as typeof query.status }), active: query.status === s.value }))} />
        <SegmentedLinks label="Period" items={RANGES.map((r) => ({ label: r.label, href: href({ range: r.value }), active: query.range === r.value }))} />
      </FilterRow>

      {result.items.length === 0 ? (
        <EmptyState icon={Route} title="No rides found" description="Try a wider time range or another status." />
      ) : (
        <>
          <DataTable caption="Rides" columns={COLUMNS} rows={result.items} rowKey={(ride) => ride.id} rowHref={(ride) => `/admin/rides/${ride.id}`} />
          <Pager page={result.page} totalPages={result.totalPages} hrefFor={(page) => href({ page })} newerLabel="Previous" olderLabel="Next" />
        </>
      )}
    </div>
  );
}
