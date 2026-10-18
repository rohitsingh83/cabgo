'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Radio, WifiOff } from 'lucide-react';

import { ActiveTripPanel, type TripAction } from '@/components/driver/ActiveTripPanel';
import { OnlineToggle } from '@/components/driver/OnlineToggle';
import { RideRequestCard } from '@/components/driver/RideRequestCard';
import { VerificationBanner } from '@/components/driver/VerificationBanner';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { useDriverFeed } from '@/hooks/use-driver-feed';
import { useDriverLocation } from '@/hooks/use-driver-location';
import { useRealtime, useSocketEvent } from '@/hooks/use-realtime';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { getBrowserPosition } from '@/lib/geo-client';
import { formatCurrency } from '@/lib/utils';
import type { DriverFeed, DriverProfile, RideWithRelations } from '@/types';

const errorMessage = (error: unknown) => (error instanceof ApiClientError ? error.message : 'Something went wrong. Please try again.');

/**
 * Driver home: availability switch, live request feed and the current trip.
 * State comes from /api/driver/feed (polled); every mutation returns fresh data that is
 * applied immediately so the UI never waits for the next poll.
 */
export function DriverConsole({ initialFeed }: { initialFeed: DriverFeed }) {
  const router = useRouter();
  const { feed, setFeed, error: feedError, refresh } = useDriverFeed(initialFeed);
  const { profile, activeRide, requests } = feed;
  /** Driver's share of a fare, using the commission reported by the server. */
  const earningsFor = (fare: number) => Math.round(fare * (100 - feed.commissionPercent)) / 100;

  const [toggling, setToggling] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [tripBusy, setTripBusy] = useState(false);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const live = profile.is_online || activeRide !== null;
  const { position, error: locationError } = useDriverLocation(live, activeRide?.id);
  const { status: socketStatus } = useRealtime();

  /* ----- realtime pushes: refetch (debounced) instead of waiting for the next poll ----- */
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSoon = useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => void refresh(), 250);
  }, [refresh]);
  useEffect(() => () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  useSocketEvent('ride:request', refreshSoon, profile.is_online && !activeRide);
  useSocketEvent('ride:cancelled', refreshSoon);
  // Someone else took the ride, or the rider cancelled while searching → drop it from the list at once.
  const dropRequest = useCallback(
    ({ rideId }: { rideId: string }) => setFeed((prev) => ({ ...prev, requests: prev.requests.filter((item) => item.ride.id !== rideId) })),
    [setFeed],
  );
  useSocketEvent('ride:taken', dropRequest);
  useSocketEvent('ride:request:expired', dropRequest);
  useSocketEvent('socket:error', ({ message }) => toast({ variant: 'destructive', title: 'Live connection', description: message }));

  const visibleRequests = useMemo(() => requests.filter((item) => !dismissed.has(item.ride.id)), [requests, dismissed]);

  /* ----- detect a rider cancelling mid-trip, and new requests arriving ----- */
  const endedByMe = useRef(false);
  const previousRideId = useRef<string | null>(initialFeed.activeRide?.id ?? null);
  const knownRequests = useRef(new Set(initialFeed.requests.map((item) => item.ride.id)));

  useEffect(() => {
    const currentId = activeRide?.id ?? null;
    if (previousRideId.current && !currentId && !endedByMe.current) {
      toast({ variant: 'destructive', title: 'Trip cancelled', description: 'The rider cancelled this trip.' });
      router.refresh();
    }
    previousRideId.current = currentId;
    endedByMe.current = false;
  }, [activeRide?.id, router]);

  useEffect(() => {
    const fresh = requests.filter((item) => !knownRequests.current.has(item.ride.id));
    fresh.forEach((item) => knownRequests.current.add(item.ride.id));
    if (fresh.length > 0 && document.visibilityState === 'visible') {
      toast({ title: 'New ride request', description: `${fresh[0]?.ride.pickup_address} · earn ${formatCurrency(fresh[0]?.estimatedEarnings ?? 0)}` });
    }
  }, [requests]);

  /* ----- actions ----- */
  const toggleOnline = useCallback(
    async (next: boolean) => {
      setToggling(true);
      try {
        // Going online needs a position so matching can find this driver.
        const fix = next ? await getBrowserPosition() : null;
        const updated = await apiFetch<DriverProfile>('/api/driver/status', {
          method: 'POST',
          body: { online: next, ...(fix ? { lat: fix.lat, lng: fix.lng } : {}) },
        });
        setFeed((prev) => ({ ...prev, profile: updated, requests: next ? prev.requests : [] }));
        toast({ variant: next ? 'success' : 'default', title: next ? "You're online" : "You're offline" });
        if (next) void refresh();
      } catch (error) {
        toast({
          variant: 'destructive',
          title: next ? 'Could not go online' : 'Could not go offline',
          description: error instanceof Error ? error.message : 'Please try again.',
        });
      } finally {
        setToggling(false);
      }
    },
    [refresh, setFeed],
  );

  const accept = async (rideId: string) => {
    setAcceptingId(rideId);
    try {
      const ride = await apiFetch<RideWithRelations>(`/api/rides/${rideId}/accept`, { method: 'POST' });
      setFeed((prev) => ({ ...prev, activeRide: ride, requests: [] }));
      toast({ variant: 'success', title: 'Ride accepted', description: `Pick up ${ride.rider?.full_name ?? 'your rider'} at ${ride.pickup_address}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not accept', description: errorMessage(error) });
      void refresh();
    } finally {
      setAcceptingId(null);
    }
  };

  const runTripAction = async (action: TripAction, reason?: string, otp?: string) => {
    if (!activeRide) return;
    setTripBusy(true);
    try {
      const ride = await apiFetch<RideWithRelations>(`/api/rides/${activeRide.id}/status`, {
        method: 'POST',
        body: { action, ...(reason ? { reason } : {}), ...(otp ? { otp } : {}) },
      });
      const finished = ride.status === 'completed' || ride.status === 'cancelled';
      if (finished) endedByMe.current = true;
      setFeed((prev) => ({ ...prev, activeRide: finished ? null : ride }));

      if (ride.status === 'in_progress') {
        toast({
          variant: 'success',
          title: 'Trip started 🚗',
          description: 'Ride PIN verified successfully. Have a safe trip!',
        });
        void refresh();
      } else if (ride.status === 'completed') {
        toast({
          variant: 'success',
          title: 'Trip completed 🎉',
          description: `You earn ${formatCurrency(earningsFor(Number(ride.final_fare ?? ride.estimated_fare)))} once the rider pays.`,
          // Drivers rate riders from the trip page — offer a one-tap shortcut while the trip is fresh.
          action: (
            <ToastAction altText="Rate the rider" onClick={() => router.push(`/driver/rides/${ride.id}`)}>
              Rate rider
            </ToastAction>
          ),
        });
        router.refresh(); // refresh the server-rendered "Today" tiles
        void refresh();
      } else if (ride.status === 'cancelled') {
        toast({ title: 'Trip cancelled', description: 'The rider was notified.' });
        void refresh();
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Action failed', description: errorMessage(error) });
      void refresh();
    } finally {
      setTripBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <VerificationBanner profile={profile} />

      {feedError && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-500" aria-hidden /> {feedError}
        </div>
      )}

      <OnlineToggle
        online={profile.is_online}
        verified={profile.is_verified}
        onTrip={activeRide !== null}
        toggling={toggling}
        locationError={live ? locationError : null}
        onToggle={toggleOnline}
      />

      {activeRide ? (
        <ActiveTripPanel
          ride={activeRide}
          position={position}
          earnings={earningsFor(Number(activeRide.estimated_fare))}
          busy={tripBusy}
          onAction={runTripAction}
        />
      ) : profile.is_online ? (
        <section aria-labelledby="requests-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="requests-heading" className="flex items-center gap-2 font-display text-lg font-extrabold">
              Ride requests
              {visibleRequests.length > 0 && (
                <span className="rounded-full bg-success px-2 py-0.5 text-xs font-bold text-white">{visibleRequests.length}</span>
              )}
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              {socketStatus === 'connected' ? 'Live' : 'Refreshing every few seconds'}
            </span>
          </div>

          {visibleRequests.length === 0 ? (
            <div className="bg-grid flex flex-col items-center rounded-3xl border border-dashed border-border px-6 py-12 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Radio className="h-7 w-7" aria-hidden />
              </span>
              <p className="font-display text-lg font-bold">Looking for riders…</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                New requests within {feed.requestRadiusKm} km appear here instantly. Stay close to busy areas for more trips.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {visibleRequests.map((item) => (
                  <motion.li
                    key={item.ride.id}
                    layout
                    initial={{ opacity: 0, y: 16, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.25 }}
                  >
                    <RideRequestCard
                      request={item}
                      accepting={acceptingId === item.ride.id}
                      locked={acceptingId !== null}
                      onAccept={() => void accept(item.ride.id)}
                      onDecline={() => setDismissed((prev) => new Set(prev).add(item.ride.id))}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
