'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, Loader2, Navigation, RefreshCw, Search, ShieldAlert, WifiOff, XCircle } from 'lucide-react';

import { RatePanel } from '@/components/rating/RatePanel';
import { SosButton } from '@/components/safety/SosButton';
import { CancelRideDialog } from '@/components/ride/CancelRideDialog';
import { DriverCard } from '@/components/ride/DriverCard';
import { FareBreakdownCard } from '@/components/ride/FareBreakdownCard';
import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { PaymentPanel, type PaymentReturn } from '@/components/payment/PaymentPanel';
import { LiveTrackingMap } from '@/components/ride/LiveTrackingMap';
import { RideOtpCard } from '@/components/ride/RideOtpCard';
import { RideTimeline } from '@/components/ride/RideTimeline';
import { getRideOtp } from '@/lib/rides/otp';
import { VEHICLE_ICONS } from '@/components/ride/vehicle-icons';
import { Button, buttonVariants } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useNow } from '@/hooks/use-now';
import { useRideLive, type LiveDriverLocation } from '@/hooks/use-ride-live';
import { useSocketEvent } from '@/hooks/use-realtime';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { BUSINESS_RULES, VEHICLES } from '@/lib/constants';
import { payableFor } from '@/lib/payments/payable';
import { getCancellationPolicy } from '@/lib/rides/cancellation';
import { cn, formatCurrency, formatDateTime, formatDistance, formatDuration } from '@/lib/utils';
import type { CancelRideResult, CreateRideResult, RideStatus, RideWithRelations } from '@/types';

/** Rides in these states never change again, so polling stops. */
const TERMINAL: readonly RideStatus[] = ['completed', 'cancelled'];
/** Polling is the safety net: fast while the socket is down, slow (just a consistency check) while it is up. */
const POLL_MS = 4000;
const POLL_MS_LIVE = 15_000;
const MAX_SILENT_FAILURES = 3;

/** Toast shown the moment the ride moves to a new state (skipped on first render). */
const STATUS_TOAST: Partial<Record<RideStatus, { title: string; description: string }>> = {
  accepted: { title: 'Driver found! 🎉', description: 'Your driver is heading to the pickup point.' },
  driver_arriving: { title: 'Your driver is arriving', description: 'Head to your pickup point.' },
  in_progress: { title: 'Trip started', description: 'Sit back and enjoy the ride.' },
  completed: { title: 'You have arrived', description: 'Hope you enjoyed the ride.' },
};

interface RideTrackerProps {
  initialRide: RideWithRelations;
  /** Present when Stripe/Checkout just sent the rider back to this page. */
  paymentReturn?: PaymentReturn;
}

/**
 * Live ride screen.
 *  - Socket.IO pushes ride events and the driver's GPS (~1 Hz) into the ride room.
 *  - The REST API is still polled — every 4 s when the socket is down, every 15 s when it is up —
 *    so the screen is correct even if realtime is unavailable.
 */
export function RideTracker({ initialRide, paymentReturn }: RideTrackerProps) {
  const [ride, setRide] = useState<RideWithRelations>(initialRide);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [offline, setOffline] = useState(false);

  const failures = useRef(0);
  const previousStatus = useRef<RideStatus>(initialRide.status);
  const isTerminal = TERMINAL.includes(ride.status);

  const refresh = useCallback(async () => {
    try {
      const next = await apiFetch<RideWithRelations>(`/api/rides/${initialRide.id}`);
      failures.current = 0;
      setOffline(false);
      setRide(next);
    } catch (error) {
      failures.current += 1;
      // A 404/403 means we lost access; anything else is treated as a flaky connection.
      if (error instanceof ApiClientError && (error.status === 404 || error.status === 403)) return;
      if (failures.current >= MAX_SILENT_FAILURES) setOffline(true);
    }
  }, [initialRide.id]);

  const live = useRideLive({ rideId: initialRide.id, enabled: !isTerminal, onRideEvent: () => void refresh() });
  useSocketEvent(
    'ride:no-drivers',
    ({ rideId }) => {
      if (rideId !== initialRide.id) return;
      void refresh();
      toast({ title: 'No drivers nearby', description: 'Try again in a moment, or cancel the ride.' });
    },
    !isTerminal,
  );

  // A finished ride stops polling, but its payment can still change (webhook after a UPI/bank delay,
  // payment made in another tab). The server nudges the rider's socket with `ride:status` — refresh then.
  const paymentOpen = isTerminal && Boolean(payableFor(ride)) && ride.payment?.status !== 'completed' && ride.payment?.status !== 'refunded';
  useSocketEvent(
    'ride:status',
    ({ rideId }) => {
      if (rideId === initialRide.id) void refresh();
    },
    paymentOpen,
  );

  // Poll while the ride is live; also refresh immediately when the tab becomes visible again.
  const pollMs = live.connected ? POLL_MS_LIVE : POLL_MS;
  useEffect(() => {
    if (isTerminal) return;
    const interval = setInterval(() => void refresh(), pollMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isTerminal, refresh, pollMs]);

  // Announce state changes.
  useEffect(() => {
    if (previousStatus.current === ride.status) return;
    previousStatus.current = ride.status;
    const message = STATUS_TOAST[ride.status];
    if (message) toast({ variant: 'success', ...message });
  }, [ride.status]);

  const searchAgain = async () => {
    setSearching(true);
    try {
      const result = await apiFetch<CreateRideResult>(`/api/rides/${ride.id}/search`, { method: 'POST' });
      setRide((prev) => ({ ...prev, ...result.ride }));
      toast({
        title: result.driversNotified > 0 ? 'Searching again' : 'Still no drivers nearby',
        description:
          result.driversNotified > 0
            ? `${result.driversNotified} driver${result.driversNotified === 1 ? '' : 's'} notified within ${result.searchRadiusKm} km.`
            : `No online drivers within ${result.searchRadiusKm} km. Try again in a moment.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not search again',
        description: error instanceof ApiClientError ? error.message : 'Something went wrong.',
      });
      void refresh();
    } finally {
      setSearching(false);
    }
  };

  const handleCancelled = (result: CancelRideResult) => {
    setRide((prev) => ({ ...prev, ...result.ride }));
  };

  const vehicle = VEHICLES[ride.ride_type];
  const VehicleIcon = VEHICLE_ICONS[ride.ride_type];
  const total = ride.final_fare ?? ride.estimated_fare;
  const canCancel = getCancellationPolicy(ride).canCancel;
  // Best known car position: the live stream, else the last position the server stored (via polling).
  const savedPosition: LiveDriverLocation | null =
    ride.driver_profile?.current_lat != null && ride.driver_profile.current_lng != null
      ? { lat: ride.driver_profile.current_lat, lng: ride.driver_profile.current_lng, heading: ride.driver_profile.current_heading ?? 0, speedKmh: 0, updatedAt: 0 }
      : null;
  const carPosition = live.location ?? savedPosition;
  const showMap = ['accepted', 'driver_arriving', 'in_progress'].includes(ride.status);
  const hasDriver = Boolean(ride.driver) && ['accepted', 'driver_arriving', 'in_progress', 'completed'].includes(ride.status);

  return (
    <div className="space-y-4">
      {offline && !isTerminal && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />
          <span className="flex-1">Connection problem — still trying to update your ride.</span>
          <Button size="sm" variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ------------------------------------------------------------ left column */}
        <div className="space-y-4">
          {showMap && <LiveTrackingMap ride={ride} position={carPosition} channel={live.channel} />}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={ride.status === 'requested' ? 'searching' : ride.status}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {(ride.status === 'requested' || ride.status === 'searching') && (
                <SearchingHero
                  status={ride.status}
                  createdAt={ride.created_at}
                  radiusKm={ride.search_radius_km}
                  busy={searching}
                  onSearchAgain={searchAgain}
                />
              )}
              {(ride.status === 'accepted' || ride.status === 'driver_arriving' || ride.status === 'in_progress') && (
                <ActiveHero status={ride.status} dropoff={ride.dropoff_address} pickup={ride.pickup_address} />
              )}
              {ride.status === 'completed' && <CompletedHero total={total} distanceKm={ride.distance_km} durationMinutes={ride.duration_minutes} />}
              {ride.status === 'cancelled' && <CancelledHero ride={ride} />}
            </motion.div>
          </AnimatePresence>

          {isTerminal && (payableFor(ride) || ride.payment) && <PaymentPanel ride={ride} onUpdated={refresh} paymentReturn={paymentReturn} />}

          {ride.status === 'completed' && ride.driver && <RatePanel rideId={ride.id} target="driver" name={ride.driver.full_name} existing={ride.rating ?? null} />}

          {hasDriver && (ride.status === 'accepted' || ride.status === 'driver_arriving') && (
            <RideOtpCard otp={getRideOtp(ride)} />
          )}

          {hasDriver && ride.driver && <DriverCard driver={ride.driver} profile={ride.driver_profile} />}

          {(ride.status === 'accepted' || ride.status === 'driver_arriving') && <FreeCancelCountdown ride={ride} />}

          {showMap && <SosButton rideId={ride.id} fallback={carPosition ?? { lat: ride.pickup_lat, lng: ride.pickup_lng }} contactsHref="/rider/profile#emergency-contacts" />}

          {!isTerminal && (
            <div className="flex flex-col gap-2 sm:flex-row">
              {canCancel ? (
                <Button variant="outline" className="h-12 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setCancelOpen(true)}>
                  <XCircle aria-hidden /> Cancel ride
                </Button>
              ) : (
                <p className="flex flex-1 items-start gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Cancelling isn&apos;t available during a trip. Contact support if something is wrong.
                </p>
              )}
            </div>
          )}

          {ride.status === 'completed' && (
            <Link href="/rider/book" className={cn(buttonVariants({ variant: 'brand', size: 'lg' }), 'h-12 w-full')}>
              <Navigation aria-hidden /> Book another ride
            </Link>
          )}
          {ride.status === 'cancelled' && (
            <Link href="/rider/book" className={cn(buttonVariants({ variant: 'brand', size: 'lg' }), 'h-12 w-full')}>
              <RefreshCw aria-hidden /> Book again
            </Link>
          )}
        </div>

        {/* ----------------------------------------------------------- right column */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-4" aria-label="Trip details">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${vehicle.gradient} text-white`}>
                  <VehicleIcon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="font-display text-base font-extrabold leading-tight">{vehicle.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(ride.created_at)}</p>
                </div>
              </div>
              <RideStatusBadge status={ride.status} />
            </div>

            <ol className="relative space-y-4">
              <span aria-hidden className="absolute bottom-3 left-[5px] top-3 w-0.5 bg-gradient-to-b from-success to-brand opacity-60" />
              <AddressRow tone="pickup" label="Pickup" address={ride.pickup_address} />
              {ride.stops.map((stop, index) => (
                <AddressRow key={`${stop.lat}-${stop.lng}-${index}`} tone="stop" label={`Stop ${index + 1}`} address={stop.address} />
              ))}
              <AddressRow tone="dropoff" label="Drop-off" address={ride.dropoff_address} />
            </ol>

            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
              <Stat label="Distance" value={formatDistance(ride.distance_km)} />
              <Stat label="Duration" value={formatDuration(ride.duration_minutes)} />
              <Stat label={ride.final_fare ? 'Fare' : 'Estimated'} value={formatCurrency(total)} />
            </dl>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4" aria-label="Ride progress">
            <h2 className="mb-4 text-sm font-semibold">Progress</h2>
            <RideTimeline ride={ride} />
          </section>

          {ride.fare_breakdown && (
            <FareBreakdownCard
              breakdown={ride.fare_breakdown}
              distanceKm={ride.distance_km}
              durationMinutes={ride.duration_minutes}
              surgeMultiplier={ride.surge_multiplier}
              stopCount={ride.stops.length}
              collapsible={!isTerminal}
            />
          )}
        </div>
      </div>

      <CancelRideDialog ride={ride} open={cancelOpen} onOpenChange={setCancelOpen} onCancelled={handleCancelled} />
    </div>
  );
}

/* ====================================================================== */
/* Hero panels                                                             */
/* ====================================================================== */

function HeroShell({ children, tone }: { children: ReactNode; tone: 'brand' | 'success' | 'danger' | 'dark' }) {
  const tones = {
    brand: 'from-brand/15 via-card to-card',
    success: 'from-success/20 via-card to-card',
    danger: 'from-destructive/15 via-card to-card',
    dark: 'from-brand/20 via-card to-card',
  } as const;
  return <section className={cn('overflow-hidden rounded-3xl border border-border bg-gradient-to-br p-6 sm:p-8', tones[tone])}>{children}</section>;
}

function Radar() {
  return (
    <div className="relative mx-auto flex h-44 w-44 items-center justify-center" aria-hidden>
      {[0, 0.65, 1.3].map((delay) => (
        <span
          key={delay}
          className="absolute inset-4 animate-pulse-ring rounded-full border-2 border-brand/60 bg-brand/10"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
      <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-gradient text-white shadow-glow">
        <Search className="h-7 w-7" />
      </span>
    </div>
  );
}

function SearchingHero({
  status,
  createdAt,
  radiusKm,
  busy,
  onSearchAgain,
}: {
  status: RideStatus;
  createdAt: string;
  radiusKm: number;
  busy: boolean;
  onSearchAgain: () => void;
}) {
  const now = useNow(1000);
  const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(createdAt).getTime()) / 1000));
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const waiting = status === 'requested';
  // After a while with no taker, nudge the rider towards a retry.
  const slow = elapsed > BUSINESS_RULES.matchingTimeoutSeconds * 2;

  return (
    <HeroShell tone="brand">
      <Radar />
      <div className="mt-2 text-center">
        <h2 className="font-display text-2xl font-extrabold tracking-tight">
          {waiting ? 'Waiting for nearby drivers' : 'Finding your driver'}
        </h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          {waiting
            ? `No drivers are online within ${radiusKm} km right now. We'll keep this request open — or tap search again.`
            : `Your request was sent to drivers within ${radiusKm} km. The first to accept gets the ride.`}
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1 text-xs font-semibold tabular-nums">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Searching for {clock}
        </p>
        {(waiting || slow) && (
          <div className="mt-5">
            <Button variant="brand" size="lg" className="h-12" onClick={onSearchAgain} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
              Search again
            </Button>
          </div>
        )}
        {!waiting && !slow && (
          <div className="mt-5">
            <Button variant="outline" onClick={onSearchAgain} disabled={busy} className="h-11">
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
              Search again
            </Button>
          </div>
        )}
      </div>
    </HeroShell>
  );
}

const ACTIVE_COPY: Record<'accepted' | 'driver_arriving' | 'in_progress', { title: string; text: string }> = {
  accepted: { title: 'Driver is on the way', text: 'Your driver accepted the ride and is heading to your pickup point.' },
  driver_arriving: { title: 'Driver is arriving', text: 'Be ready at your pickup point — your driver is almost there.' },
  in_progress: { title: 'Enjoy your ride', text: 'You are on your way to your destination.' },
};

function ActiveHero({ status, pickup, dropoff }: { status: 'accepted' | 'driver_arriving' | 'in_progress'; pickup: string; dropoff: string }) {
  const copy = ACTIVE_COPY[status];
  const target = status === 'in_progress' ? dropoff : pickup;
  return (
    <HeroShell tone="success">
      <div className="flex items-start gap-4">
        <span className="relative mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-success text-white shadow-glow-green">
          <Navigation className="h-6 w-6" aria-hidden />
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl border-2 border-success" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.text}</p>
          <p className="mt-3 truncate text-sm font-semibold">
            <span className="font-normal text-muted-foreground">{status === 'in_progress' ? 'Heading to ' : 'Pickup at '}</span>
            {target}
          </p>
        </div>
      </div>
    </HeroShell>
  );
}

function CompletedHero({ total, distanceKm, durationMinutes }: { total: number; distanceKm: number; durationMinutes: number }) {
  return (
    <HeroShell tone="success">
      <div className="text-center">
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success text-white shadow-glow-green"
        >
          <CheckCircle2 className="h-9 w-9" aria-hidden />
        </motion.span>
        <h2 className="mt-4 font-display text-2xl font-extrabold tracking-tight">Trip completed</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDistance(distanceKm)} · {formatDuration(durationMinutes)}
        </p>
        <p className="mt-4 font-display text-5xl font-extrabold tabular-nums tracking-tight">{formatCurrency(total)}</p>
        <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">Total fare</p>
      </div>
    </HeroShell>
  );
}

function CancelledHero({ ride }: { ride: RideWithRelations }) {
  const fee = Number(ride.cancellation_fee);
  return (
    <HeroShell tone="danger">
      <div className="flex items-start gap-4">
        <span className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-destructive text-white">
          <XCircle className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Ride cancelled</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ride.cancellation_reason ?? 'This ride was cancelled.'}
          </p>
          <p className={cn('mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold', fee > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-success/15 text-success')}>
            {fee > 0 ? `Cancellation fee: ${formatCurrency(fee)}` : 'No charge'}
          </p>
        </div>
      </div>
    </HeroShell>
  );
}

/* ====================================================================== */
/* Small pieces                                                            */
/* ====================================================================== */

/** Free-cancellation countdown card (ticks every second from `accepted_at`). */
function FreeCancelCountdown({ ride }: { ride: RideWithRelations }) {
  const now = useNow(1000);
  const policy = getCancellationPolicy(ride, now);
  const total = BUSINESS_RULES.freeCancellationSeconds;
  const percent = Math.min(100, Math.max(0, (policy.freeSecondsLeft / total) * 100));
  const minutes = Math.floor(policy.freeSecondsLeft / 60);
  const seconds = String(policy.freeSecondsLeft % 60).padStart(2, '0');

  return (
    <div className="rounded-2xl border border-border bg-card p-4" role="timer" aria-live="off">
      {policy.isFree ? (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Free cancellation</span>
            <span className="font-display text-lg font-extrabold tabular-nums text-success">
              {minutes}:{seconds}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-success transition-all duration-1000 ease-linear" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Cancel without a fee until the timer runs out.</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          The free cancellation window has ended. Cancelling now costs <strong className="text-foreground">{formatCurrency(policy.fee)}</strong>.
        </p>
      )}
    </div>
  );
}

function AddressRow({ tone, label, address }: { tone: 'pickup' | 'stop' | 'dropoff'; label: string; address: string }) {
  return (
    <li className="relative flex items-start gap-3">
      <span className="relative z-10 mt-1 flex h-3 w-3 shrink-0 items-center justify-center">
        {tone === 'pickup' && <span className="h-3 w-3 rounded-full bg-success ring-4 ring-card" />}
        {tone === 'stop' && <span className="h-2.5 w-2.5 rounded-full bg-foreground ring-4 ring-card" />}
        {tone === 'dropoff' && <span className="h-3 w-3 rounded-[3px] bg-brand ring-4 ring-card" />}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm font-medium leading-snug">{address}</p>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-base font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}
