import type { Metadata } from 'next';
import { BadgeCheck } from 'lucide-react';

import { VerificationBadge } from '@/components/admin/AdminBadges';
import { AdminSearch, buildHref, FilterRow } from '@/components/admin/AdminToolbar';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { PersonCell } from '@/components/admin/PersonCell';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pager } from '@/components/shared/Pager';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { listDrivers, type AdminDriverRow } from '@/lib/admin/drivers';
import { parseSearchParams } from '@/lib/admin/search-params';
import { requireRole } from '@/lib/auth';
import { VEHICLES } from '@/lib/constants';
import { formatDate, timeAgo } from '@/lib/utils';
import { adminDriversQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Drivers' };
export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
] as const;

const COLUMNS: Column<AdminDriverRow>[] = [
  { key: 'driver', header: 'Driver', cell: (row) => <PersonCell user={row.user} /> },
  {
    key: 'vehicle',
    header: 'Vehicle',
    cell: (row) => (
      <span className="block">
        <span className="block text-sm font-medium">
          {VEHICLES[row.vehicle_type].label} · {row.vehicle_model}
        </span>
        <span className="block font-mono text-xs text-muted-foreground">{row.vehicle_plate}</span>
      </span>
    ),
  },
  { key: 'status', header: 'Verification', cell: (row) => <VerificationBadge status={row.verification_status} /> },
  {
    key: 'online',
    header: 'Online',
    cell: (row) => (row.is_online ? <span className="font-semibold text-success">● Online</span> : <span className="text-muted-foreground">Offline</span>),
    hideOnMobile: true,
  },
  { key: 'rating', header: 'Rating', cell: (row) => (row.rating_count > 0 ? `${Number(row.average_rating).toFixed(1)} ★ (${row.rating_count})` : '—'), hideOnMobile: true },
  { key: 'applied', header: 'Applied', cell: (row) => <span title={formatDate(row.created_at)}>{timeAgo(row.created_at)}</span> },
];

export default async function AdminDriversPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireRole('admin');
  const query = parseSearchParams(adminDriversQuerySchema, searchParams);
  const result = await listDrivers(query);

  const href = (patch: Partial<typeof query>) => buildHref('/admin/drivers', { ...query, ...patch, page: patch.page ?? 1 }, { status: 'pending' });

  return (
    <div className="space-y-6">
      <PageHeader title="Drivers" description="Review applications and keep an eye on the fleet." className="mb-0" />

      <FilterRow>
        <AdminSearch action="/admin/drivers" placeholder="Search name, email or plate" q={query.q} keep={{ status: query.status === 'pending' ? undefined : query.status }} clearHref={href({ q: undefined })} />
        <SegmentedLinks label="Verification status" items={STATUSES.map((s) => ({ label: s.label, href: href({ status: s.value }), active: query.status === s.value }))} />
      </FilterRow>

      {result.items.length === 0 ? (
        <EmptyState
          icon={BadgeCheck}
          title={query.status === 'pending' && !query.q ? 'No applications waiting' : 'No drivers found'}
          description={query.status === 'pending' && !query.q ? 'New driver applications will show up here for review.' : 'Try another filter or search term.'}
        />
      ) : (
        <>
          <DataTable caption="Drivers" columns={COLUMNS} rows={result.items} rowKey={(row) => row.id} rowHref={(row) => `/admin/drivers/${row.user_id}`} />
          <Pager page={result.page} totalPages={result.totalPages} hrefFor={(page) => href({ page })} newerLabel="Previous" olderLabel="Next" />
        </>
      )}
    </div>
  );
}
