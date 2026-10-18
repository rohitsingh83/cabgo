'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

import { BookingMap } from '@/components/maps/BookingMap';
import { BookingPanel } from '@/components/ride/BookingPanel';
import { toast } from '@/components/ui/use-toast';
import { useFareEstimate } from '@/hooks/use-fare-estimate';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useNearbyDrivers } from '@/hooks/use-nearby-drivers';
import { locateCurrentPlace, reverseGeocodeClient } from '@/lib/geo-client';
import { cn } from '@/lib/utils';
import { useBookingStore } from '@/store/useBookingStore';
import type { LatLng, Place, SavedPlace } from '@/types';

interface BookingExperienceProps {
  savedPlaces: SavedPlace[];
  /** Drop-off preselected via `?to=<savedPlaceId>`. */
  initialDropoff: Place | null;
}

/**
 * Full-bleed booking screen. The map fills the page; on mobile the form is a bottom sheet
 * that can be collapsed to reveal the map, on desktop it is a 440px side panel.
 */
export function BookingExperience({ savedPlaces, initialDropoff }: BookingExperienceProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [sheetOpen, setSheetOpen] = useState(true);

  const pickup = useBookingStore((s) => s.pickup);
  const dropoff = useBookingStore((s) => s.dropoff);
  const stops = useBookingStore((s) => s.stops);
  const promoCode = useBookingStore((s) => s.promoCode);
  const setPickup = useBookingStore((s) => s.setPickup);
  const setDropoff = useBookingStore((s) => s.setDropoff);
  const reset = useBookingStore((s) => s.reset);

  const filledStops = useMemo(() => stops.flatMap((stop) => (stop.place ? [stop.place] : [])), [stops]);
  const hasEmptyStop = stops.some((stop) => !stop.place);

  // Only quote once every row the rider added has an address.
  const estimate = useFareEstimate({
    pickup,
    dropoff: hasEmptyStop ? null : dropoff,
    stops: filledStops,
    promoCode,
  });
  const drivers = useNearbyDrivers(pickup, null);

  // Start every booking from a clean slate, apply the ?to= shortcut, and clear on leave.
  useEffect(() => {
    reset();
    if (initialDropoff) setDropoff(initialDropoff);

    // Auto-detect only when permission was already granted — never surprise the rider with a prompt.
    let cancelled = false;
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then(async (status) => {
          if (status.state !== 'granted' || cancelled) return;
          const place = await locateCurrentPlace();
          if (!cancelled && !useBookingStore.getState().pickup) setPickup(place);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount
  }, []);

  const handlePickupDrag = useCallback(
    async (point: LatLng) => {
      const place = await reverseGeocodeClient(point);
      setPickup(place);
    },
    [setPickup],
  );

  const handleLocateMe = useCallback(async () => {
    try {
      setPickup(await locateCurrentPlace());
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not get your location',
        description: error instanceof Error ? error.message : 'Allow location access and try again.',
      });
    }
  }, [setPickup]);

  // Keep the route clear of the mobile sheet when fitting map bounds.
  const bottomInset = isDesktop ? 0 : sheetOpen ? 360 : 76;

  // `fixed` instead of negative margins: the map must break out of the dashboard's max-w-7xl
  // container on wide screens. It sits between the sticky header (4rem), the sidebar (16rem,
  // desktop) and the mobile tab bar (~3.75rem + safe area).
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] top-16 z-0 overflow-hidden bg-muted lg:bottom-0 lg:left-64 lg:flex">
      <BookingMap
        className="absolute inset-0 lg:static lg:order-2 lg:flex-1"
        pickup={pickup}
        dropoff={dropoff}
        stops={filledStops}
        polyline={estimate.data?.route.polyline ?? null}
        drivers={drivers}
        onPickupDragEnd={handlePickupDrag}
        onLocateMe={handleLocateMe}
        bottomInset={bottomInset}
      />

      {/*
        One panel element serves both layouts (no duplicated inputs / ids):
        mobile → animated bottom sheet, desktop → static 440px side panel.
      */}
      <motion.aside
        aria-label="Book a ride"
        className="absolute inset-x-0 bottom-0 z-10 flex flex-col overflow-hidden rounded-t-3xl border-t border-border bg-background shadow-sheet lg:static lg:order-1 lg:w-[440px] lg:shrink-0 lg:rounded-none lg:border-r lg:border-t-0 lg:shadow-none"
        initial={false}
        animate={{ height: isDesktop ? '100%' : sheetOpen ? 'min(84%, 680px)' : 56 }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      >
        <button
          type="button"
          onClick={() => setSheetOpen((open) => !open)}
          aria-expanded={sheetOpen}
          aria-label={sheetOpen ? 'Collapse booking panel' : 'Expand booking panel'}
          className="flex h-14 w-full shrink-0 flex-col items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:hidden"
        >
          <span className="h-1.5 w-10 rounded-full bg-border" aria-hidden />
          <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            {sheetOpen ? 'Show map' : 'Book a ride'}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !sheetOpen && 'rotate-180')} aria-hidden />
          </span>
        </button>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <BookingPanel savedPlaces={savedPlaces} estimate={estimate} />
        </div>
      </motion.aside>
    </div>
  );
}
