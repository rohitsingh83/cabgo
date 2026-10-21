'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Navigation, Wallet } from 'lucide-react';

import { PromoInput } from '@/components/promo/PromoInput';
import { FareBreakdownCard } from '@/components/ride/FareBreakdownCard';
import { RouteForm } from '@/components/ride/RouteForm';
import { VehicleSelector } from '@/components/ride/VehicleSelector';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { VEHICLES } from '@/lib/constants';
import { apiFetch, isApiClientError } from '@/lib/api-client';
import { formatCurrency } from '@/lib/utils';
import { useBookingStore } from '@/store/useBookingStore';
import type { CreateRideResult, FareEstimateResponse, SavedPlace } from '@/types';

export interface EstimateState {
  data: FareEstimateResponse | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface BookingPanelProps {
  savedPlaces: SavedPlace[];
  estimate: EstimateState;
}

/**
 * The booking form: route → ride type → promo → fare breakdown → confirm.
 * The fare hook lives in the parent so the map can draw the quoted route polyline.
 */
export function BookingPanel({ savedPlaces, estimate }: BookingPanelProps) {
  const router = useRouter();
  const pickup = useBookingStore((s) => s.pickup);
  const dropoff = useBookingStore((s) => s.dropoff);
  const stops = useBookingStore((s) => s.stops);
  const rideType = useBookingStore((s) => s.rideType);
  const promoCode = useBookingStore((s) => s.promoCode);
  const setRideType = useBookingStore((s) => s.setRideType);
  const setPromoCode = useBookingStore((s) => s.setPromoCode);

  const [submitting, setSubmitting] = useState(false);

  const filledStops = useMemo(() => stops.flatMap((stop) => (stop.place ? [stop.place] : [])), [stops]);
  const hasEmptyStop = stops.some((stop) => !stop.place);
  const hasRoute = Boolean(pickup && dropoff) && !hasEmptyStop;

  const { data, loading, error, refetch } = estimate;
  const selected = data?.estimates.find((item) => item.rideType === rideType) ?? null;
  const vehicle = VEHICLES[rideType];
  const noDrivers = selected !== null && selected.etaMinutes === null;

  const canConfirm = hasRoute && !loading && !submitting && selected !== null && !error;

  const confirm = async () => {
    if (!pickup || !dropoff || !selected) return;
    setSubmitting(true);
    try {
      const result = await apiFetch<CreateRideResult>('/api/rides', {
        method: 'POST',
        body: {
          pickup,
          dropoff,
          stops: filledStops,
          rideType,
          ...(promoCode ? { promoCode } : {}),
          // The server re-prices and rejects the request if the fare moved since this screen.
          expectedTotal: selected.breakdown.total,
        },
      });
      toast({
        variant: 'success',
        title: result.driversNotified > 0 ? 'Looking for your driver' : 'Ride requested',
        description:
          result.driversNotified > 0
            ? `${result.driversNotified} nearby driver${result.driversNotified === 1 ? '' : 's'} notified.`
            : 'No drivers are online nearby yet — we will keep trying.',
      });
      // Stay in the "submitting" state while navigating so the button can't be double-tapped.
      router.push(`/rider/tracking/${result.ride.id}`);
    } catch (err) {
      setSubmitting(false);
      if (isApiClientError(err)) {
        const activeRideId = err.details?.rideId?.[0];
        if (err.status === 409 && activeRideId) {
          toast({ title: 'You already have a ride', description: 'Taking you to it…' });
          router.push(`/rider/tracking/${activeRideId}`);
          return;
        }
        if (err.status === 402 && activeRideId) {
          // Outstanding payment: send the rider to the ride that still needs paying.
          toast({ title: 'Payment due', description: err.message });
          router.push(`/rider/tracking/${activeRideId}`);
          return;
        }
        if (err.status === 409 && /fare changed/i.test(err.message)) {
          toast({ title: 'Fare updated', description: `${err.message} Review the new price and confirm again.` });
          refetch();
          return;
        }
        toast({ variant: 'destructive', title: 'Could not book your ride', description: err.message });
        return;
      }
      toast({
        variant: 'destructive',
        title: 'Could not book your ride',
        description: (err as Error)?.message || 'Something went wrong. Please try again.',
      });
    }
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1 space-y-5 px-4 pb-4 pt-2 lg:pt-6">
        <div className="hidden lg:block">
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Where to?</h1>
          <p className="text-sm text-muted-foreground">Add up to 3 stops. Prices lock in when you confirm.</p>
        </div>

        <RouteForm
          savedPlaces={savedPlaces}
          disabled={submitting}
          onError={(message) => toast({ variant: 'destructive', title: 'Location problem', description: message })}
        />

        <VehicleSelector
          quote={data}
          hasRoute={hasRoute}
          loading={loading}
          error={error}
          selected={rideType}
          onSelect={setRideType}
          onRetry={refetch}
        />

        {data && selected && (
          <>
            {data.route.approximate && (
              <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                Distance is estimated from a straight line. The final fare uses the real route.
              </p>
            )}

            <PromoInput
              appliedCode={promoCode}
              result={data.promo}
              checking={loading}
              savings={selected.breakdown.discount}
              onApply={setPromoCode}
              onRemove={() => setPromoCode(null)}
            />

            <FareBreakdownCard
              breakdown={selected.breakdown}
              distanceKm={selected.distanceKm}
              durationMinutes={selected.durationMinutes}
              surgeMultiplier={selected.surgeMultiplier}
              stopCount={filledStops.length}
            />

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              Pay securely by card after your trip. Free cancellation for the first 2 minutes after a driver accepts.
            </p>
          </>
        )}
      </div>

      {/* Sticky confirm bar — always reachable on small screens */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        {noDrivers && (
          <p className="mb-2 flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400" role="status">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            No {vehicle.label} drivers are nearby right now. You can still book — we&apos;ll keep searching.
          </p>
        )}
        <Button size="lg" className="h-14 w-full text-base font-bold" onClick={confirm} disabled={!canConfirm}>
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Requesting…
            </>
          ) : selected && hasRoute ? (
            <>
              Book {vehicle.label} · {formatCurrency(selected.breakdown.total, selected.breakdown.currency)}
            </>
          ) : (
            'Enter your trip to continue'
          )}
        </Button>
      </div>
    </div>
  );
}
