import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Hourglass, TrendingUp, Trophy, Wallet } from 'lucide-react';

import { EarningsChart } from '@/components/driver/LazyEarningsChart';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { requireDriverWithProfile } from '@/lib/drivers/guard';
import { getDriverEarningsReport } from '@/lib/drivers/service';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { earningsRangeSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Earnings' };
export const dynamic = 'force-dynamic';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

export default async function DriverEarningsPage({ searchParams }: { searchParams: { days?: string } }) {
  const { user } = await requireDriverWithProfile();
  const { days } = earningsRangeSchema.parse({ days: searchParams.days });
  const report = await getDriverEarningsReport(user.id, days);

  const best = report.daily.reduce((top, day) => (day.earnings > top.earnings ? day : top), report.daily[0] ?? { day: '', earnings: 0, rides_count: 0 });
  const average = report.paidRides > 0 ? report.paid / report.paidRides : 0;

  const tiles = [
    { label: `Earned · last ${days} days`, value: formatCurrency(report.paid), sub: `${report.paidRides} paid trip${report.paidRides === 1 ? '' : 's'}`, icon: Wallet, tone: 'bg-success/10 text-success' },
    { label: 'Awaiting payment', value: formatCurrency(report.pending), sub: `${report.pendingRides} trip${report.pendingRides === 1 ? '' : 's'} not yet paid`, icon: Hourglass, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { label: 'Average per trip', value: formatCurrency(average), sub: 'After platform fee', icon: TrendingUp, tone: 'bg-brand/10 text-brand' },
    {
      label: 'Best day',
      value: formatCurrency(best.earnings),
      sub: best.earnings > 0 ? new Date(`${best.day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'No earnings yet',
      icon: Trophy,
      tone: 'bg-purple-500/10 text-purple-500',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earnings"
        description="What you've earned after the platform fee."
        className="mb-0"
        actions={<SegmentedLinks label="Date range" items={RANGES.map((r) => ({ label: r.label, href: `/driver/earnings?days=${r.days}`, active: r.days === days }))} />}
      />

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, sub, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 truncate font-display text-2xl font-extrabold tabular-nums">{value}</p>
            <p className="truncate text-xs font-medium">{label}</p>
            <p className="truncate text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-card p-5" aria-labelledby="chart-heading">
        <h2 id="chart-heading" className="mb-4 font-display text-lg font-extrabold">
          Daily earnings
        </h2>
        <EarningsChart data={report.daily} />
      </section>

      <section aria-labelledby="payouts-heading">
        <h2 id="payouts-heading" className="mb-3 font-display text-lg font-extrabold">
          Recent payments
        </h2>
        {report.recent.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments yet" description="Once riders pay for completed trips, your earnings appear here." />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {report.recent.map((item) => (
              <li key={item.id}>
                <Link href={`/driver/rides/${item.rideId}`} className="flex min-h-[64px] items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.dropoffAddress ?? 'Trip'}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                  </div>
                  <p className="font-display text-lg font-extrabold tabular-nums text-success">+{formatCurrency(item.amount)}</p>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
