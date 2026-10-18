import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, LifeBuoy, Star } from 'lucide-react';

import { RatePanel } from '@/components/rating/RatePanel';
import { FareBreakdownCard } from '@/components/ride/FareBreakdownCard';
import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { RideTimeline } from '@/components/ride/RideTimeline';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { BUSINESS_RULES, VEHICLES } from '@/lib/constants';
import { requireDriverWithProfile } from '@/lib/drivers/guard';
import { driverShare } from '@/lib/drivers/service';
import { getOwnRating } from '@/lib/ratings/service';
import { getRideWithRelations } from '@/lib/rides/service';
import { formatCurrency, formatDateTime, formatDistance, formatDuration, roundTo } from '@/lib/utils';
import { uuidSchema } from '@/lib/validations';

export const metadata: Metadata = { title: 'Ride details' };
export const dynamic = 'force-dynamic';

export default async function DriverRideDetailPage({ params }: { params: { id: string } }) {
  const { user } = await requireDriverWithProfile();

  if (!uuidSchema.safeParse(params.id).success) notFound();
  const ride = await getRideWithRelations(params.id);
  if (!ride || ride.driver_id !== user.id) notFound();

  // The driver's own rating of the rider (the ride's `rating` is the rider's rating of the driver).
  const myRating = ride.status === 'completed' && ride.rider ? await getOwnRating(ride.id, user.id) : null;

  const fare = Number(ride.final_fare ?? ride.estimated_fare);
  const payment = ride.payment && ride.payment.status === 'completed' ? ride.payment : null;
  const earnings = payment ? Number(payment.driver_earnings) : driverShare(fare);
  const commission = payment ? Number(payment.platform_fee) : roundTo(fare - earnings);
  const cancelled = ride.status === 'cancelled';
  const vehicle = VEHICLES[ride.ride_type];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/driver/rides" className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All rides
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Ride details</h1>
          <RideStatusBadge status={ride.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDateTime(ride.created_at)} · {vehicle.label}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5" aria-label="Route">
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
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Distance</dt>
                <dd className="mt-0.5 font-display text-base font-extrabold tabular-nums">{formatDistance(ride.distance_km)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Duration</dt>
                <dd className="mt-0.5 font-display text-base font-extrabold tabular-nums">{formatDuration(ride.duration_minutes)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Surge</dt>
                <dd className="mt-0.5 font-display text-base font-extrabold tabular-nums">{Number(ride.surge_multiplier).toFixed(1)}×</dd>
              </div>
            </dl>
          </section>

          {ride.rider && (
            <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4" aria-label="Rider">
              <UserAvatar name={ride.rider.full_name} src={ride.rider.avatar_url} className="h-12 w-12" />
              <div>
                <p className="text-xs text-muted-foreground">Rider</p>
                <p className="font-display text-lg font-extrabold">{ride.rider.full_name}</p>
              </div>
            </section>
          )}

          {ride.status === 'completed' && ride.rider && <RatePanel rideId={ride.id} target="rider" name={ride.rider.full_name} existing={myRating} />}

          {ride.rating && (
            <section className="rounded-2xl border border-border bg-card p-4" aria-label="Rider's rating">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rating from rider</p>
              <div className="flex items-center gap-1" aria-label={`${ride.rating.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={i < ride.rating!.rating ? 'h-5 w-5 fill-amber-400 text-amber-400' : 'h-5 w-5 text-muted-foreground/40'} aria-hidden />
                ))}
              </div>
              {ride.rating.review_text && <p className="mt-3 text-sm">&ldquo;{ride.rating.review_text}&rdquo;</p>}
              {ride.rating.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ride.rating.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5" aria-label="Earnings">
            {cancelled ? (
              <>
                <p className="font-display text-lg font-extrabold">Trip cancelled</p>
                <p className="mt-1 text-sm text-muted-foreground">{ride.cancellation_reason ?? 'This trip was cancelled.'}</p>
                <p className="mt-3 text-sm text-muted-foreground">No earnings for cancelled trips.</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">You earn</p>
                <p className="font-display text-4xl font-extrabold tabular-nums text-success">{formatCurrency(earnings)}</p>
                <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Rider paid</dt>
                    <dd className="font-semibold tabular-nums">{formatCurrency(fare)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Platform fee ({BUSINESS_RULES.platformCommissionPercent}%)</dt>
                    <dd className="font-semibold tabular-nums">−{formatCurrency(commission)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Payment</dt>
                    <dd>
                      <Badge variant={payment ? 'success' : ride.status === 'completed' ? 'warning' : 'secondary'}>
                        {payment ? 'Settled' : ride.status === 'completed' ? 'Awaiting rider' : 'Not yet due'}
                      </Badge>
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5" aria-label="Progress">
            <h2 className="mb-4 text-sm font-semibold">Progress</h2>
            <RideTimeline ride={ride} />
          </section>

          {ride.fare_breakdown && !cancelled && (
            <FareBreakdownCard
              breakdown={ride.fare_breakdown}
              distanceKm={ride.distance_km}
              durationMinutes={ride.duration_minutes}
              surgeMultiplier={Number(ride.surge_multiplier)}
              stopCount={ride.stops.length}
              collapsible
            />
          )}

          <Link href="/driver/support" className="flex min-h-[56px] items-center gap-3 rounded-2xl border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-brand/50">
            <LifeBuoy className="h-5 w-5 text-brand" aria-hidden /> Problem with this trip? Contact support
          </Link>
        </div>
      </div>
    </div>
  );
}
