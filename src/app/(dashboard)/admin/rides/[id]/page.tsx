import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShieldAlert, Star } from 'lucide-react';

import { SosStatusBadge } from '@/components/admin/AdminBadges';
import { AdminCancelRide } from '@/components/admin/AdminCancelRide';
import { AdminSection, BackLink, InfoList } from '@/components/admin/AdminSection';
import { PersonCell } from '@/components/admin/PersonCell';
import { RefundButton } from '@/components/admin/RefundButton';
import { PaymentStatusBadge } from '@/components/payment/PaymentStatusBadge';
import { FareBreakdownCard } from '@/components/ride/FareBreakdownCard';
import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { RideTimeline } from '@/components/ride/RideTimeline';
import { TicketStatusBadge } from '@/components/support/TicketStatusBadge';
import { Badge } from '@/components/ui/badge';
import { getAdminRideDetail } from '@/lib/admin/rides';
import { requireRole } from '@/lib/auth';
import { ACTIVE_RIDE_STATUSES, VEHICLES } from '@/lib/constants';
import { formatCurrency, formatDateTime, formatDistance, formatDuration, timeAgo } from '@/lib/utils';
import { uuidSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Ride details' };
export const dynamic = 'force-dynamic';

export default async function AdminRideDetailPage({ params }: { params: { id: string } }) {
  await requireRole('admin');
  if (!uuidSchema.safeParse(params.id).success) notFound();
  const detail = await getAdminRideDetail(params.id);
  if (!detail) notFound();

  const { ride, rider, driver, payments, ratings, sosAlerts, tickets } = detail;
  const vehicle = VEHICLES[ride.ride_type];
  const live = ACTIVE_RIDE_STATUSES.includes(ride.status);
  const fare = Number(ride.final_fare ?? ride.estimated_fare);
  // `cancelled_by` stores a user id: the rider, the driver, or (anyone else) an admin / the system.
  const cancelledBy = ride.cancelled_by === ride.rider_id ? 'the rider' : ride.cancelled_by && ride.cancelled_by === ride.driver_id ? 'the driver' : 'CabGo support';

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/admin/rides">All rides</BackLink>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Ride details</h1>
              <RideStatusBadge status={ride.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateTime(ride.created_at)} · {vehicle.label} · <span className="font-mono text-xs">{ride.id.slice(0, 8)}</span>
            </p>
          </div>
          {live && <AdminCancelRide rideId={ride.id} />}
        </div>
      </div>

      {sosAlerts.some((alert) => alert.status === 'active') && (
        <Link href="/admin/sos" role="alert" className="flex items-center gap-3 rounded-2xl border-2 border-destructive/60 bg-destructive/10 p-4 text-sm font-semibold text-destructive">
          <ShieldAlert className="h-5 w-5" aria-hidden /> There is an active SOS alert on this ride — open the alert list.
        </Link>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <AdminSection title="Route">
            <ol className="relative space-y-4">
              <span aria-hidden className="absolute bottom-3 left-[5px] top-3 w-0.5 bg-gradient-to-b from-success to-brand opacity-60" />
              <li className="relative flex items-start gap-3">
                <span className="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full bg-success ring-4 ring-card" aria-hidden />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pickup</p>
                  <p className="text-sm font-medium">{ride.pickup_address}</p>
                </div>
              </li>
              {ride.stops.map((stop, index) => (
                <li key={`${stop.lat}-${stop.lng}-${index}`} className="relative flex items-start gap-3">
                  <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground ring-4 ring-card" aria-hidden />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Stop {index + 1}</p>
                    <p className="text-sm font-medium">{stop.address}</p>
                  </div>
                </li>
              ))}
              <li className="relative flex items-start gap-3">
                <span className="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-[3px] bg-brand ring-4 ring-card" aria-hidden />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Drop-off</p>
                  <p className="text-sm font-medium">{ride.dropoff_address}</p>
                </div>
              </li>
            </ol>
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
              {[
                ['Distance', formatDistance(ride.distance_km)],
                ['Duration', formatDuration(ride.duration_minutes)],
                ['Surge', `${Number(ride.surge_multiplier).toFixed(1)}×`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-display text-base font-extrabold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
          </AdminSection>

          <AdminSection title="People">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rider</p>
                {rider ? (
                  <Link href={`/admin/users/${rider.id}`} className="block rounded-xl p-2 -m-2 hover:bg-muted/60">
                    <PersonCell user={rider} />
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">Account removed</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Driver</p>
                {driver ? (
                  <Link href={`/admin/drivers/${driver.id}`} className="block rounded-xl p-2 -m-2 hover:bg-muted/60">
                    <PersonCell user={driver} />
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">No driver assigned</p>
                )}
              </div>
            </div>
            {ride.status === 'cancelled' && (
              <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm">
                <span className="font-semibold">Cancelled by {cancelledBy}:</span> {ride.cancellation_reason ?? 'No reason given.'}
                {Number(ride.cancellation_fee) > 0 && <span className="ml-1 font-semibold">Fee {formatCurrency(Number(ride.cancellation_fee))}</span>}
              </p>
            )}
          </AdminSection>

          {ratings.length > 0 && (
            <AdminSection title="Ratings">
              <ul className="space-y-3">
                {ratings.map((rating) => {
                  const fromRider = rating.from_user_id === ride.rider_id;
                  return (
                    <li key={rating.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{fromRider ? 'Rider → driver' : 'Driver → rider'}</p>
                        <div className="flex" aria-label={`${rating.rating} out of 5`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={i < rating.rating ? 'h-4 w-4 fill-amber-400 text-amber-400' : 'h-4 w-4 text-muted-foreground/40'} aria-hidden />
                          ))}
                        </div>
                      </div>
                      {rating.review_text && <p className="mt-2 text-sm">&ldquo;{rating.review_text}&rdquo;</p>}
                      {rating.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {rating.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </AdminSection>
          )}

          {(sosAlerts.length > 0 || tickets.length > 0) && (
            <AdminSection title="Safety & support">
              <ul className="space-y-2">
                {sosAlerts.map((alert) => (
                  <li key={alert.id}>
                    <Link href="/admin/sos" className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-border px-3 hover:border-destructive/50">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <ShieldAlert className="h-4 w-4 text-destructive" aria-hidden /> SOS · {timeAgo(alert.created_at)}
                      </span>
                      <SosStatusBadge status={alert.status} />
                    </Link>
                  </li>
                ))}
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <Link href={`/admin/support/${ticket.id}`} className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-border px-3 hover:border-brand/50">
                      <span className="truncate text-sm font-semibold">{ticket.subject}</span>
                      <TicketStatusBadge status={ticket.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </AdminSection>
          )}
        </div>

        <div className="space-y-6">
          <AdminSection title="Money">
            <p className="font-display text-4xl font-extrabold tabular-nums">{formatCurrency(fare)}</p>
            <p className="text-xs text-muted-foreground">{ride.final_fare === null ? 'Estimated fare' : 'Final fare'}</p>
            {payments.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No payment attempted yet.</p>
            ) : (
              <ul className="mt-4 space-y-3 border-t border-border pt-4">
                {payments.map((payment) => (
                  <li key={payment.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold tabular-nums">{formatCurrency(Number(payment.amount))}</span>
                      <PaymentStatusBadge status={payment.status} />
                    </div>
                    <InfoList
                      items={[
                        { label: 'Platform fee', value: formatCurrency(Number(payment.platform_fee)) },
                        { label: 'Driver earnings', value: formatCurrency(Number(payment.driver_earnings)) },
                        { label: 'When', value: formatDateTime(payment.created_at) },
                        ...(payment.failure_reason ? [{ label: 'Failure', value: payment.failure_reason }] : []),
                      ]}
                    />
                    {payment.status === 'completed' && <RefundButton paymentId={payment.id} amount={Number(payment.amount)} />}
                  </li>
                ))}
              </ul>
            )}
          </AdminSection>

          <AdminSection title="Progress">
            <RideTimeline ride={ride} />
          </AdminSection>

          {ride.fare_breakdown && ride.status !== 'cancelled' && (
            <FareBreakdownCard breakdown={ride.fare_breakdown} distanceKm={ride.distance_km} durationMinutes={ride.duration_minutes} surgeMultiplier={Number(ride.surge_multiplier)} stopCount={ride.stops.length} collapsible />
          )}
        </div>
      </div>
    </div>
  );
}
