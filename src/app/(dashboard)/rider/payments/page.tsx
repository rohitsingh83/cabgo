import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, Hourglass, Receipt, Wallet } from 'lucide-react';

import { PaymentDueBanner } from '@/components/payment/PaymentDueBanner';
import { PaymentRow } from '@/components/payment/PaymentRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Reveal } from '@/components/shared/Reveal';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { buttonVariants } from '@/components/ui/button';
import { requireRole } from '@/lib/auth';
import { getPaymentDues, getPaymentSummary, listPayments } from '@/lib/payments/service';
import { cn, formatCurrency } from '@/lib/utils';
import { paymentsQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Payments' };
export const dynamic = 'force-dynamic';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Paid' },
  { value: 'pending', label: 'Due' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
] as const;

export default async function RiderPaymentsPage({
  searchParams,
}: {
  searchParams: { page?: string; status?: string };
}) {
  const user = await requireRole('rider');
  // Bad query strings (?page=abc) fall back to the defaults instead of crashing the page.
  const parsed = paymentsQuerySchema.safeParse({
    page: searchParams.page,
    status: searchParams.status,
  });
  const query = parsed.success ? parsed.data : paymentsQuerySchema.parse({});

  const dues = await getPaymentDues(user.id, 10);
  const [history, summary] = await Promise.all([
    listPayments(user, query),
    getPaymentSummary(user.id, dues),
  ]);

  const href = (status: string, page = 1) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return `/rider/payments${qs ? `?${qs}` : ''}`;
  };

  const tiles = [
    {
      label: 'Total paid',
      value: formatCurrency(summary.totalPaid),
      sub: `${summary.paymentCount} payment${summary.paymentCount === 1 ? '' : 's'}`,
      icon: Wallet,
      tone: 'bg-success/10 text-success',
    },
    {
      label: 'This month',
      value: formatCurrency(summary.paidThisMonth),
      sub: 'Since the 1st',
      icon: CalendarDays,
      tone: 'bg-brand/10 text-brand',
    },
    {
      label: 'Outstanding',
      value: formatCurrency(summary.dueTotal),
      sub: summary.dueTotal > 0 ? 'Pay to keep booking' : 'All settled',
      icon: Hourglass,
      tone:
        summary.dueTotal > 0
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-muted text-muted-foreground',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Your receipts, payment status and anything still due."
        className="mb-0"
      />

      <Reveal>
        <PaymentDueBanner dues={dues} />
      </Reveal>

      <Reveal delay={0.04}>
        <section aria-label="Summary" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tiles.map(({ label, value, sub, icon: Icon, tone }) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}
              >
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-2xl font-extrabold tabular-nums">
                  {value}
                </p>
                <p className="truncate text-xs font-medium">{label}</p>
                <p className="truncate text-xs text-muted-foreground">{sub}</p>
              </div>
            </div>
          ))}
        </section>
      </Reveal>

      <Reveal delay={0.08}>
        <section aria-labelledby="history-heading" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="history-heading" className="font-display text-lg font-extrabold">
              Payment history
            </h2>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <SegmentedLinks
                label="Filter by status"
                items={FILTERS.map((f) => ({
                  label: f.label,
                  href: href(f.value),
                  active: f.value === query.status,
                }))}
              />
            </div>
          </div>

          {history.items.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={query.status === 'all' ? 'No payments yet' : 'Nothing here'}
              description={
                query.status === 'all'
                  ? 'Once you pay for a ride, its receipt shows up here.'
                  : 'No payments match this filter.'
              }
              action={
                query.status === 'all' ? (
                  <Link
                    href="/rider/book"
                    className={buttonVariants({ variant: 'brand', size: 'lg' })}
                  >
                    Book a ride
                  </Link>
                ) : (
                  <Link
                    href="/rider/payments"
                    className={buttonVariants({ variant: 'outline', size: 'lg' })}
                  >
                    Show all
                  </Link>
                )
              }
            />
          ) : (
            <ul className="space-y-3">
              {history.items.map((payment) => (
                <li key={payment.id}>
                  <PaymentRow payment={payment} />
                </li>
              ))}
            </ul>
          )}

          {history.totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between pt-2">
              {query.page > 1 ? (
                <Link
                  href={href(query.status, query.page - 1)}
                  className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}
                >
                  <ArrowLeft aria-hidden /> Newer
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted-foreground">
                Page {history.page} of {history.totalPages}
              </span>
              {query.page < history.totalPages ? (
                <Link
                  href={href(query.status, query.page + 1)}
                  className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}
                >
                  Older <ArrowRight aria-hidden />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </Reveal>
    </div>
  );
}
