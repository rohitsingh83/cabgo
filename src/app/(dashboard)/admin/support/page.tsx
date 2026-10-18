import type { Metadata } from 'next';
import { LifeBuoy } from 'lucide-react';

import { RoleBadge } from '@/components/admin/AdminBadges';
import { AdminSearch, buildHref, FilterRow } from '@/components/admin/AdminToolbar';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { PersonCell } from '@/components/admin/PersonCell';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pager } from '@/components/shared/Pager';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { TicketStatusBadge } from '@/components/support/TicketStatusBadge';
import { listAdminTickets, type AdminTicketRow } from '@/lib/admin/support';
import { parseSearchParams } from '@/lib/admin/search-params';
import { requireRole } from '@/lib/auth';
import { TICKET_CATEGORIES } from '@/lib/constants';
import { TICKET_CATEGORY_LABEL } from '@/lib/feedback';
import { timeAgo } from '@/lib/utils';
import { adminTicketsQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Support' };
export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
] as const;

const COLUMNS: Column<AdminTicketRow>[] = [
  {
    key: 'subject',
    header: 'Ticket',
    cell: (ticket) => (
      <span className="block min-w-0 max-w-sm">
        <span className="block truncate text-sm">{ticket.subject}</span>
        <span className="block text-xs font-normal text-muted-foreground">{TICKET_CATEGORY_LABEL[ticket.category]}</span>
      </span>
    ),
  },
  { key: 'from', header: 'From', cell: (ticket) => <PersonCell user={ticket.user} showContact={false} /> },
  { key: 'role', header: 'Role', cell: (ticket) => (ticket.user ? <RoleBadge role={ticket.user.role} /> : '—'), hideOnMobile: true },
  { key: 'status', header: 'Status', cell: (ticket) => <TicketStatusBadge status={ticket.status} /> },
  { key: 'opened', header: 'Opened', cell: (ticket) => timeAgo(ticket.created_at) },
];

export default async function AdminSupportPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireRole('admin');
  const query = parseSearchParams(adminTicketsQuerySchema, searchParams);
  const result = await listAdminTickets(query);

  const href = (patch: Partial<typeof query>) => buildHref('/admin/support', { ...query, ...patch, page: patch.page ?? 1 }, { status: 'open', category: 'all' });

  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="Oldest tickets first within each status — reply, then resolve." className="mb-0" />

      <FilterRow>
        <AdminSearch action="/admin/support" placeholder="Search subject or message" q={query.q} keep={{ status: query.status === 'open' ? undefined : query.status, category: query.category === 'all' ? undefined : query.category }} clearHref={href({ q: undefined })} />
        <SegmentedLinks label="Status" items={STATUSES.map((s) => ({ label: s.label, href: href({ status: s.value }), active: query.status === s.value }))} />
      </FilterRow>
      <FilterRow>
        <SegmentedLinks label="Category" items={[{ value: 'all', label: 'Any category' }, ...TICKET_CATEGORIES].map((c) => ({ label: c.label, href: href({ category: c.value as typeof query.category }), active: query.category === c.value }))} />
      </FilterRow>

      {result.items.length === 0 ? (
        <EmptyState icon={LifeBuoy} title={query.status === 'open' && !query.q && query.category === 'all' ? 'Inbox zero' : 'No tickets found'} description={query.status === 'open' && !query.q ? 'Every ticket has been picked up. Nice work.' : 'Try another status, category or search term.'} />
      ) : (
        <>
          <DataTable caption="Support tickets" columns={COLUMNS} rows={result.items} rowKey={(ticket) => ticket.id} rowHref={(ticket) => `/admin/support/${ticket.id}`} />
          <Pager page={result.page} totalPages={result.totalPages} hrefFor={(page) => href({ page })} newerLabel="Previous" olderLabel="Next" />
        </>
      )}
    </div>
  );
}
