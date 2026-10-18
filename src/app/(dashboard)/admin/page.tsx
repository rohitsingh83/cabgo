import type { Metadata } from 'next';
import Link from 'next/link';
import { Activity, ArrowRight, BadgeCheck, Banknote, CarFront, LifeBuoy, ShieldAlert, TrendingUp, Users, Zap } from 'lucide-react';

import { AdminStatTile } from '@/components/admin/AdminStatTile';
import { PersonCell } from '@/components/admin/PersonCell';
import { RevenueRidesChart, StatusDonut, VehicleMixChart } from '@/components/admin/LazyCharts';
import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { Reveal } from '@/components/shared/Reveal';
import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { getActiveSos, getDailyStats, getOverview, getRecentRides, getRideStatusBreakdown, getTopDrivers, getVehicleMix } from '@/lib/admin/stats';
import { parseSearchParams } from '@/lib/admin/search-params';
import { requireRole } from '@/lib/auth';
import { formatCurrency, formatDateTime, timeAgo } from '@/lib/utils';
import { adminOverviewQuerySchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Admin overview' };
export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90] as const;

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-2xl border border-border bg-card p-5 ${className ?? ''}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default async function AdminOverviewPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  await requireRole('admin');
  const { days } = parseSearchParams(adminOverviewQuerySchema, searchParams);

  // Independent queries run in parallel; every one is a single indexed query or RPC.
  const [overview, daily, statuses, vehicles, topDrivers, activeSos, recent] = await Promise.all([
    getOverview(),
    getDailyStats(days),
    getRideStatusBreakdown(days),
    getVehicleMix(days),
    getTopDrivers(days),
    getActiveSos(3),
    getRecentRides(6),
  ]);

  const periodRevenue = daily.reduce((sum, day) => sum + day.revenue, 0);
  const periodRides = daily.reduce((sum, day) => sum + day.rides_count, 0);
  const finished = overview.completed_rides + overview.cancelled_rides;
  const completionRate = finished > 0 ? Math.round((overview.completed_rides / finished) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="How CabGo is doing right now."
        className="mb-0"
        actions={<SegmentedLinks label="Time range" items={RANGES.map((value) => ({ label: `${value}d`, href: value === 30 ? '/admin' : `/admin?days=${value}`, active: value === days }))} />}
      />

      {activeSos.length > 0 && (
        <Reveal>
          <section role="alert" aria-label="Active SOS alerts" className="rounded-2xl border-2 border-destructive/60 bg-destructive/10 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-destructive text-white">
                  <span className="absolute inset-0 animate-ping rounded-full bg-destructive opacity-40" aria-hidden />
                  <ShieldAlert className="relative h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-display text-lg font-extrabold text-destructive">
                    {overview.active_sos} active SOS alert{overview.active_sos === 1 ? '' : 's'}
                  </p>
                  <p className="text-sm text-muted-foreground">Someone on a trip asked for help. Follow up first.</p>
                </div>
              </div>
              <Link href="/admin/sos" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-destructive px-4 text-sm font-semibold text-white hover:bg-destructive/90">
                Open alerts <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-3">
              {activeSos.map((alert) => (
                <li key={alert.id} className="rounded-xl bg-background/80 p-3">
                  <PersonCell user={alert.user} />
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(alert.created_at)}</p>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      )}

      <Reveal delay={0.03}>
        <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStatTile label={`Revenue · ${days}d`} value={formatCurrency(periodRevenue)} hint={`${formatCurrency(Number(overview.platform_revenue))} platform total`} icon={Banknote} tone="bg-success/10 text-success" href="/admin/payments" />
          <AdminStatTile label={`Rides · ${days}d`} value={periodRides.toLocaleString('en-IN')} hint={`${overview.rides_today} today`} icon={TrendingUp} tone="bg-brand/10 text-brand" href="/admin/rides" />
          <AdminStatTile label="Live rides" value={String(overview.active_rides)} hint={`${completionRate}% completion rate`} icon={Activity} tone="bg-sky-500/10 text-sky-600 dark:text-sky-400" href="/admin/rides?status=active" />
          <AdminStatTile label="Drivers online" value={String(overview.online_drivers)} hint={`${overview.total_drivers} registered`} icon={CarFront} tone="bg-success/10 text-success" href="/admin/drivers?status=approved" />
          <AdminStatTile label="Pending verifications" value={String(overview.pending_verifications)} hint={overview.pending_verifications > 0 ? 'Drivers are waiting' : 'All caught up'} icon={BadgeCheck} tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" href="/admin/drivers" attention={overview.pending_verifications > 0} />
          <AdminStatTile label="Open tickets" value={String(overview.open_tickets)} hint={overview.open_tickets > 0 ? 'Needs a reply' : 'Inbox zero'} icon={LifeBuoy} tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" href="/admin/support" attention={overview.open_tickets > 0} />
          <AdminStatTile label="Users" value={overview.total_users.toLocaleString('en-IN')} hint={`${overview.total_riders} riders`} icon={Users} tone="bg-brand/10 text-brand" href="/admin/users" />
          <AdminStatTile label="All-time revenue" value={formatCurrency(Number(overview.total_revenue))} hint={`${overview.total_rides.toLocaleString('en-IN')} rides`} icon={Zap} tone="bg-foreground/10 text-foreground" />
        </section>
      </Reveal>

      <Reveal delay={0.06}>
        <Panel title="Revenue & rides" action={<span className="text-xs text-muted-foreground">Last {days} days</span>}>
          <RevenueRidesChart data={daily} />
        </Panel>
      </Reveal>

      <Reveal delay={0.09}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Ride outcomes">
            <StatusDonut data={statuses.filter((item) => item.count > 0)} />
          </Panel>
          <Panel title="Vehicle mix" action={<span className="text-xs text-muted-foreground">Completed rides</span>}>
            <VehicleMixChart data={vehicles} />
          </Panel>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Top drivers" action={<span className="text-xs text-muted-foreground">By earnings · {days}d</span>}>
            {topDrivers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No settled payments in this period yet.</p>
            ) : (
              <ol className="space-y-1">
                {topDrivers.map((entry, index) => (
                  <li key={entry.driverId}>
                    <Link href={`/admin/drivers/${entry.driverId}`} className="flex min-h-[56px] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/60">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-extrabold tabular-nums">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <PersonCell user={entry.driver} showContact={false} />
                      </div>
                      <div className="text-right">
                        <p className="font-display text-base font-extrabold tabular-nums text-success">{formatCurrency(entry.earnings)}</p>
                        <p className="text-xs text-muted-foreground">{entry.rides} ride{entry.rides === 1 ? '' : 's'}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Latest rides" action={<Link href="/admin/rides" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-brand hover:underline">View all <ArrowRight className="h-4 w-4" aria-hidden /></Link>}>
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No rides yet.</p>
            ) : (
              <ul className="space-y-1">
                {recent.map((ride) => (
                  <li key={ride.id}>
                    <Link href={`/admin/rides/${ride.id}`} className="flex min-h-[56px] items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {ride.pickup_address} → {ride.dropoff_address}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {ride.rider?.full_name ?? 'Unknown rider'} · {formatDateTime(ride.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <RideStatusBadge status={ride.status} />
                        <span className="text-xs font-semibold tabular-nums">{formatCurrency(Number(ride.final_fare ?? ride.estimated_fare))}</span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
