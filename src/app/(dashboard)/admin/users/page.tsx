import type { Metadata } from 'next';
import { Users } from 'lucide-react';

import { RoleBadge, UserStatusBadge } from '@/components/admin/AdminBadges';
import { AdminSearch, buildHref, FilterRow } from '@/components/admin/AdminToolbar';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ExportButton } from '@/components/admin/ExportButton';
import { PersonCell } from '@/components/admin/PersonCell';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pager } from '@/components/shared/Pager';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { parseSearchParams } from '@/lib/admin/search-params';
import { listUsers } from '@/lib/admin/users';
import { requireRole } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import { adminUsersQuerySchema } from '@/lib/validations';
import type { User } from '@/types';

export const metadata: Metadata = { title: 'Users' };
export const dynamic = 'force-dynamic';

const ROLES = [
  { value: 'all', label: 'All' },
  { value: 'rider', label: 'Riders' },
  { value: 'driver', label: 'Drivers' },
  { value: 'admin', label: 'Admins' },
] as const;
const STATUSES = [
  { value: 'all', label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
] as const;

const COLUMNS: Column<User>[] = [
  { key: 'user', header: 'User', cell: (user) => <PersonCell user={user} /> },
  { key: 'role', header: 'Role', cell: (user) => <RoleBadge role={user.role} /> },
  { key: 'status', header: 'Status', cell: (user) => <UserStatusBadge active={user.is_active} /> },
  { key: 'phone', header: 'Phone', cell: (user) => user.phone ?? '—', hideOnMobile: true },
  { key: 'joined', header: 'Joined', cell: (user) => formatDate(user.created_at) },
];

export default async function AdminUsersPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireRole('admin');
  const query = parseSearchParams(adminUsersQuerySchema, searchParams);
  const result = await listUsers(query);

  const href = (patch: Partial<typeof query>) => buildHref('/admin/users', { ...query, ...patch, page: patch.page ?? 1 }, { role: 'all', status: 'all' });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${result.total.toLocaleString('en-IN')} account${result.total === 1 ? '' : 's'} match your filters.`}
        className="mb-0"
        actions={<ExportButton type="users" status={query.role} />}
      />

      <FilterRow>
        <AdminSearch action="/admin/users" placeholder="Search name, email or phone" q={query.q} keep={{ role: query.role === 'all' ? undefined : query.role, status: query.status === 'all' ? undefined : query.status }} clearHref={href({ q: undefined })} />
        <SegmentedLinks label="Role" items={ROLES.map((r) => ({ label: r.label, href: href({ role: r.value }), active: query.role === r.value }))} />
        <SegmentedLinks label="Status" items={STATUSES.map((s) => ({ label: s.label, href: href({ status: s.value }), active: query.status === s.value }))} />
      </FilterRow>

      {result.items.length === 0 ? (
        <EmptyState icon={Users} title="No users found" description={query.q ? `Nothing matches “${query.q}”. Try a different name, email or phone number.` : 'No accounts match these filters.'} />
      ) : (
        <>
          <DataTable caption="Users" columns={COLUMNS} rows={result.items} rowKey={(user) => user.id} rowHref={(user) => `/admin/users/${user.id}`} />
          <Pager page={result.page} totalPages={result.totalPages} hrefFor={(page) => href({ page })} newerLabel="Previous" olderLabel="Next" />
        </>
      )}
    </div>
  );
}
