'use client';

import { useState } from 'react';
import { Flag, Loader2, MapPinCheck, Navigation, Phone, Play, XCircle } from 'lucide-react';

import { BookingMap } from '@/components/maps/BookingMap';
import { SosButton } from '@/components/safety/SosButton';
import { RideStatusBadge } from '@/components/ride/RideStatusBadge';
import { UserAvatar } from '@/components/shared/UserAvatar';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import type { DriverPosition } from '@/hooks/use-driver-location';
import { cn, formatCurrency, formatDistance, formatDuration } from '@/lib/utils';
import type { NearbyDriverMarker, RideWithRelations } from '@/types';

export type TripAction = 'arrived' | 'start' | 'complete' | 'cancel';

interface ActiveTripPanelProps {
  ride: RideWithRelations;
  position: DriverPosition | null;
  /** What the driver keeps from this fare. */
  earnings: number;
  busy: boolean;
  onAction: (action: TripAction, reason?: string, otp?: string) => Promise<void>;
}

const CANCEL_REASONS = ['Rider not at pickup', 'Rider unreachable', 'Unsafe pickup location', 'Vehicle problem', 'Other'] as const;

const STEP_COPY = {
  accepted: { heading: 'Head to the pickup', hint: 'Drive to the pickup point. Tap the button when you get there.' },
  driver_arriving: { heading: 'Waiting for the rider', hint: 'Confirm the rider is in the car, then verify their 4-digit PIN to start the trip.' },
  in_progress: { heading: 'Trip in progress', hint: 'Follow the route and drop the rider at their destination.' },
} as const;

/** Google Maps turn-by-turn link: pickup first, then (after pickup) the stops and the drop-off. */
function navigationUrl(ride: RideWithRelations): string {
  const base = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
  if (ride.status !== 'in_progress') return `${base}&destination=${ride.pickup_lat},${ride.pickup_lng}`;
  const waypoints = ride.stops.map((stop) => `${stop.lat},${stop.lng}`).join('|');
  return `${base}&destination=${ride.dropoff_lat},${ride.dropoff_lng}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}`;
}

export function ActiveTripPanel({ ride, position, earnings, busy, onAction }: ActiveTripPanelProps) {
  const [dialog, setDialog] = useState<'cancel' | 'complete' | 'otp' | null>(null);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const status = ride.status as keyof typeof STEP_COPY;
  const copy = STEP_COPY[status] ?? STEP_COPY.accepted;
  const canCancel = ride.status === 'accepted' || ride.status === 'driver_arriving';
  const toPickup = ride.status !== 'in_progress';

  const self: NearbyDriverMarker[] = position
    ? [{ id: 'me', lat: position.lat, lng: position.lng, heading: position.heading, vehicleType: ride.ride_type, distanceKm: 0 }]
    : [];

  const run = async (action: TripAction, why?: string, otp?: string) => {
    await onAction(action, why, otp);
    setDialog(null);
  };

  const handleStartTripWithOtp = async () => {
    if (otpInput.trim().length !== 4) {
      setOtpError('Please enter all 4 digits of the rider PIN.');
      return;
    }
    setOtpError(null);
    try {
      await onAction('start', undefined, otpInput.trim());
      setDialog(null);
    } catch {
      // Toast handles error display
    }
  };

  const primary =
    ride.status === 'accepted'
      ? { label: "I've arrived at pickup", icon: MapPinCheck, onClick: () => run('arrived') }
      : ride.status === 'driver_arriving'
        ? { label: 'Start trip (Verify PIN)', icon: Play, onClick: () => { setOtpInput(''); setOtpError(null); setDialog('otp'); } }
        : { label: 'Complete trip', icon: Flag, onClick: () => setDialog('complete') };
  const PrimaryIcon = primary.icon;

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft" aria-label="Current trip">
      <div className="relative h-56 bg-muted sm:h-72">
        <BookingMap
          className="absolute inset-0"
          pickup={{ address: ride.pickup_address, lat: ride.pickup_lat, lng: ride.pickup_lng }}
          dropoff={{ address: ride.dropoff_address, lat: ride.dropoff_lat, lng: ride.dropoff_lng }}
          stops={ride.stops}
          polyline={ride.route_polyline}
          drivers={self}
        />
        <a
          href={navigationUrl(ride)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ variant: 'default' }), 'absolute left-3 top-3 h-11 shadow-lift')}
        >
          <Navigation aria-hidden /> Navigate
        </a>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-extrabold tracking-tight">{copy.heading}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.hint}</p>
          </div>
          <RideStatusBadge status={ride.status} />
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
          <UserAvatar name={ride.rider?.full_name} src={ride.rider?.avatar_url} className="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{ride.rider?.full_name ?? 'Rider'}</p>
            <p className="truncate text-xs text-muted-foreground">
              {toPickup ? ride.pickup_address : `To ${ride.dropoff_address}`}
            </p>
          </div>
          {ride.rider?.phone && (
            <a
              href={`tel:${ride.rider.phone}`}
              aria-label={`Call ${ride.rider.full_name}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'rounded-full')}
            >
              <Phone className="h-4 w-4" />
            </a>
          )}
        </div>

        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-border p-3">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">You earn</dt>
            <dd className="mt-0.5 font-display text-lg font-extrabold tabular-nums text-success">{formatCurrency(earnings)}</dd>
          </div>
          <div className="rounded-xl border border-border p-3">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Distance</dt>
            <dd className="mt-0.5 font-display text-lg font-extrabold tabular-nums">{formatDistance(ride.distance_km)}</dd>
          </div>
          <div className="rounded-xl border border-border p-3">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Time</dt>
            <dd className="mt-0.5 font-display text-lg font-extrabold tabular-nums">{formatDuration(ride.duration_minutes)}</dd>
          </div>
        </dl>

        <ol className="relative space-y-3">
          <span aria-hidden className="absolute bottom-3 left-[5px] top-3 w-0.5 bg-gradient-to-b from-success to-brand opacity-60" />
          <li className="relative flex items-start gap-3">
            <span className="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-full bg-success ring-4 ring-card" aria-hidden />
            <p className="text-sm font-medium">{ride.pickup_address}</p>
          </li>
          {ride.stops.map((stop, index) => (
            <li key={`${stop.lat}-${stop.lng}-${index}`} className="relative flex items-start gap-3">
              <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground ring-4 ring-card" aria-hidden />
              <p className="text-sm text-muted-foreground">Stop {index + 1}: {stop.address}</p>
            </li>
          ))}
          <li className="relative flex items-start gap-3">
            <span className="relative z-10 mt-1.5 h-3 w-3 shrink-0 rounded-[3px] bg-brand ring-4 ring-card" aria-hidden />
            <p className="text-sm font-medium">{ride.dropoff_address}</p>
          </li>
        </ol>

        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button variant="success" size="lg" className="h-14 flex-1 text-base font-bold" onClick={primary.onClick} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <PrimaryIcon aria-hidden />}
            {primary.label}
          </Button>
          {canCancel && (
            <Button
              variant="outline"
              className="h-14 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:px-6"
              onClick={() => setDialog('cancel')}
              disabled={busy}
            >
              <XCircle aria-hidden /> Cancel trip
            </Button>
          )}
        </div>

        <SosButton rideId={ride.id} fallback={position ? { lat: position.lat, lng: position.lng } : { lat: ride.pickup_lat, lng: ride.pickup_lng }} contactsHref="/driver/profile#emergency-contacts" />
      </div>

      {/* Complete confirmation */}
      <AlertDialog open={dialog === 'complete'} onOpenChange={(open) => !open && !busy && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              Only complete the trip once the rider has reached their destination. The rider will be asked to pay{' '}
              {formatCurrency(Number(ride.estimated_fare))}, and you earn {formatCurrency(earnings)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={busy} className="mt-0 h-11">
              Not yet
            </AlertDialogCancel>
            <Button variant="success" className="h-11" onClick={() => run('complete')} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />} Complete trip
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel with reason */}
      <AlertDialog open={dialog === 'cancel'} onOpenChange={(open) => !open && !busy && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              The rider is not charged, but frequent cancellations affect your standing. Tell us why:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <fieldset className="space-y-2" disabled={busy}>
            <legend className="sr-only">Reason for cancelling</legend>
            {CANCEL_REASONS.map((item) => (
              <label
                key={item}
                className={cn(
                  'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3 text-sm transition-colors',
                  reason === item ? 'border-brand bg-brand/5 font-semibold' : 'border-border hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name="driver-cancel-reason"
                  value={item}
                  checked={reason === item}
                  onChange={() => setReason(item)}
                  className="h-4 w-4 accent-[hsl(var(--brand))]"
                />
                {item}
              </label>
            ))}
          </fieldset>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={busy} className="mt-0 h-11">
              Keep trip
            </AlertDialogCancel>
            <Button variant="destructive" className="h-11" onClick={() => run('cancel', reason)} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />} Cancel trip
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ride OTP Verification Dialog */}
      <AlertDialog open={dialog === 'otp'} onOpenChange={(open) => !open && !busy && setDialog(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl font-bold">
              Verify Rider PIN
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ask the passenger for their 4-digit ride verification code displayed on their screen to start the trip.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex flex-col items-center justify-center gap-2">
              <label htmlFor="driver-ride-otp" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Enter 4-Digit PIN
              </label>
              <input
                id="driver-ride-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                placeholder="• • • •"
                value={otpInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setOtpInput(val);
                  setOtpError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && otpInput.length === 4) {
                    void handleStartTripWithOtp();
                  }
                }}
                className="h-14 w-48 rounded-2xl border-2 border-primary/50 bg-background text-center font-mono text-3xl font-extrabold tracking-[0.5em] text-foreground focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20"
              />
              {otpError && (
                <p className="text-xs font-medium text-destructive animate-fade-in">
                  {otpError}
                </p>
              )}
            </div>
            <p className="text-center text-[11px] text-muted-foreground">
              This confirms passenger pickup and begins live fare & GPS tracking.
            </p>
          </div>

          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={busy} className="mt-0 h-11">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="brand"
              className="h-11"
              onClick={handleStartTripWithOtp}
              disabled={busy || otpInput.trim().length !== 4}
            >
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play className="h-4 w-4" />}
              Verify & Start Trip
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
