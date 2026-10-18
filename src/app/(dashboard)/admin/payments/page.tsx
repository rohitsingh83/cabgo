import type { Metadata } from 'next';
import Link from 'next/link';
import { Banknote, CircleAlert, Coins, Hourglass, Landmark, RotateCcw } from 'lucide-react';

import { AdminStatTile } from '@/components/admin/AdminStatTile';
import { buildHref, FilterRow } from '@/components/admin/AdminToolbar';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { ExportButton } from '@/components/admin/ExportButton';
import { PersonCell } from '@/components/admin/PersonCell';
import { RefundButton } from '@/components/admin/RefundButton';
import { PaymentStatusBadge } from '@/components/payment/PaymentStatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Pager } from '@/components/shared/Pager';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { getPaymentTotals, listAdminPayments, type AdminPaymentRow } from '@/lib/admin/payments';
import { parseSearchParams } from '@/lib/admin/search-params';
import { requireRole } from '@/lib/auth';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { adminPaymentsQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Paid' },
  { value: 'pending', label: 'Due' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
] as const;
const RANGES = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
  { value: 'all', label: 'All time' },
] as const;

const COLUMNS: Column<AdminPaymentRow>[] = [
  {
    key: 'ride',
    header: 'Payment',
    cell: (payment) => (
      <span className="block min-w-0 max-w-xs">
        {payment.ride ? (
          <Link href={`/admin/rides/${payment.ride.id}`} className="block truncate text-sm font-semibold hover:text-brand hover:underline">
            {payment.ride.pickup_address} → {payment.ride.dropoff_address}
          </Link>
        ) : (
          <span className="block text-sm font-semibold">Ride removed</span>
        )}
        <span className="block text-xs font-normal text-muted-foreground">{formatDateTime(payment.created_at)}</span>
      </span>
    ),
  },
  { key: 'rider', header: 'Rider', cell: (payment) => <PersonCell user={payment.rider} showContact={false} /> },
  { key: 'amount', header: 'Amount', align: 'right', cell: (payment) => <span className="font-semibold">{formatCurrency(Number(payment.amount))}</span> },
  { key: 'fee', header: 'Platform fee', align: 'right', cell: (payment) => formatCurrency(Number(payment.platform_fee)), hideOnMobile: true },
  { key: 'status', header: 'Status', cell: (payment) => <PaymentStatusBadge status={payment.status} /> },
  {
    key: 'action',
    header: '',
    align: 'right',
    cell: (payment) => (payment.status === 'completed' ? <RefundButton paymentId={payment.id} amount={Number(payment.amount)} compact /> : payment.status === 'failed' && payment.failure_reason ? <span className="text-xs text-muted-foreground">{payment.failure_reason}</span> : null),
  },
];

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireRole('admin');
  const query = parseSearchParams(adminPaymentsQuerySchema, searchParams);
  const [result, totals] = await Promise.all([listAdminPayments(query), getPaymentTotals(query.range)]);

  const href = (patch: Partial<typeof query>) => buildHref('/admin/payments', { ...query, ...patch, page: patch.page ?? 1 }, { status: 'all', range: 'all' });

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Settled revenue, platform fees and refunds." className="mb-0" actions={<ExportButton type="payments" range={query.range} status={query.status} />} />

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <AdminStatTile label="Gross" value={formatCurrency(totals.gross)} icon={Banknote} tone="bg-success/10 text-success" />
        <AdminStatTile label="Platform fees" value={formatCurrency(totals.platformFees)} icon={Landmark} tone="bg-brand/10 text-brand" />
        <AdminStatTile label="Driver earnings" value={formatCurrency(totals.driverEarnings)} icon={Coins} tone="bg-sky-500/10 text-sky-600 dark:text-sky-400" />
        <AdminStatTile label="Refunded" value={formatCurrency(totals.refunded)} icon={RotateCcw} tone="bg-muted text-muted-foreground" />
        <AdminStatTile label="Awaiting payment" value={String(totals.pendingCount)} icon={Hourglass} tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" attention={totals.pendingCount > 0} />
        <AdminStatTile label="Failed" value={String(totals.failedCount)} icon={CircleAlert} tone="bg-destructive/10 text-destructive" attention={totals.failedCount > 0} />
      </section>

      <FilterRow>
        <SegmentedLinks label="Status" items={STATUSES.map((s) => ({ label: s.label, href: href({ status: s.value }), active: query.status === s.value }))} />
        <SegmentedLinks label="Period" items={RANGES.map((r) => ({ label: r.label, href: href({ range: r.value }), active: query.range === r.value }))} />
      </FilterRow>

      {result.items.length === 0 ? (
        <EmptyState icon={Banknote} title="No payments found" description="Try a wider time range or another status." />
      ) : (
        <>
          <DataTable caption="Payments" columns={COLUMNS} rows={result.items} rowKey={(payment) => payment.id} />
          <Pager page={result.page} totalPages={result.totalPages} hrefFor={(page) => href({ page })} newerLabel="Previous" olderLabel="Next" />
        </>
      )}
    </div>
  );
}
