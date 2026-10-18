'use client';

import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, Briefcase, Home, Plus, Star, X } from 'lucide-react';

import { PlaceSearchInput } from '@/components/maps/PlaceSearchInput';
import { MAX_STOPS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useBookingStore } from '@/store/useBookingStore';
import type { Place, SavedPlace } from '@/types';

interface RouteFormProps {
  savedPlaces: SavedPlace[];
  onError?: (message: string) => void;
  /** Lock the form while a ride is being requested. */
  disabled?: boolean;
}

const SAVED_ICON = { home: Home, work: Briefcase, custom: Star } as const;

function toPlace(saved: SavedPlace): Place {
  return { address: saved.address, lat: saved.lat, lng: saved.lng, name: saved.name ?? undefined };
}

/**
 * Pickup → (up to 3 stops) → drop-off, wired to the booking store.
 * A vertical connector links the markers: green dot, numbered stops, blue square.
 */
export function RouteForm({ savedPlaces, onError, disabled = false }: RouteFormProps) {
  const pickup = useBookingStore((s) => s.pickup);
  const dropoff = useBookingStore((s) => s.dropoff);
  const stops = useBookingStore((s) => s.stops);
  const setPickup = useBookingStore((s) => s.setPickup);
  const setDropoff = useBookingStore((s) => s.setDropoff);
  const addStop = useBookingStore((s) => s.addStop);
  const setStop = useBookingStore((s) => s.setStop);
  const removeStop = useBookingStore((s) => s.removeStop);
  const moveStop = useBookingStore((s) => s.moveStop);
  const swapEndpoints = useBookingStore((s) => s.swapEndpoints);

  const chips = useMemo(() => {
    // Home / Work first, then custom places; capped so the row stays a single line of chips.
    const order = { home: 0, work: 1, custom: 2 } as const;
    return [...savedPlaces].sort((a, b) => order[a.label] - order[b.label]).slice(0, 6);
  }, [savedPlaces]);

  const canAddStop = stops.length < MAX_STOPS;

  return (
    <div className="space-y-3">
      <ol className="relative space-y-2">
        {/* Connector line running behind the markers (marker column is 28px wide, centre at 14px). */}
        <span aria-hidden className="absolute bottom-6 left-[13px] top-6 w-0.5 rounded-full bg-gradient-to-b from-success via-border to-brand" />

        <li className="relative grid grid-cols-[28px_1fr_auto] items-center gap-2">
          <span className="z-10 flex justify-center" aria-hidden>
            <span className="h-3.5 w-3.5 rounded-full bg-success ring-4 ring-background" />
          </span>
          <PlaceSearchInput
            label="Pickup location"
            hideLabel
            placeholder="Pickup location"
            value={pickup}
            onChange={setPickup}
            savedPlaces={savedPlaces}
            allowCurrentLocation
            onError={onError}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={swapEndpoints}
            disabled={disabled || (!pickup && !dropoff)}
            aria-label="Swap pickup and drop-off"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </li>

        <AnimatePresence initial={false}>
          {stops.map((stop, index) => (
            <motion.li
              key={stop.id}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="relative grid grid-cols-[28px_1fr_auto] items-center gap-2"
            >
              <span className="z-10 flex justify-center" aria-hidden>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background ring-4 ring-background">
                  {index + 1}
                </span>
              </span>
              <PlaceSearchInput
                label={`Stop ${index + 1}`}
                hideLabel
                placeholder={`Stop ${index + 1}`}
                value={stop.place}
                onChange={(place) => setStop(stop.id, place)}
                savedPlaces={savedPlaces}
                locationBias={pickup}
                onError={onError}
                disabled={disabled}
              />
              <div className="flex items-center">
                {stops.length > 1 && (
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveStop(stop.id, -1)}
                      disabled={disabled || index === 0}
                      aria-label={`Move stop ${index + 1} up`}
                      className="flex h-[22px] w-9 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveStop(stop.id, 1)}
                      disabled={disabled || index === stops.length - 1}
                      aria-label={`Move stop ${index + 1} down`}
                      className="flex h-[22px] w-9 items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeStop(stop.id)}
                  disabled={disabled}
                  aria-label={`Remove stop ${index + 1}`}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>

        <li className="relative grid grid-cols-[28px_1fr_auto] items-center gap-2">
          <span className="z-10 flex justify-center" aria-hidden>
            <span className="h-3.5 w-3.5 rounded-[3px] bg-brand ring-4 ring-background" />
          </span>
          <PlaceSearchInput
            label="Drop-off location"
            hideLabel
            placeholder="Where to?"
            value={dropoff}
            onChange={setDropoff}
            savedPlaces={savedPlaces}
            locationBias={pickup}
            onError={onError}
            disabled={disabled}
          />
          <span className="w-11" aria-hidden />
        </li>
      </ol>

      <div className="flex items-center justify-between gap-2 pl-9">
        <button
          type="button"
          onClick={addStop}
          disabled={disabled || !canAddStop}
          className={cn(
            'inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand transition-colors hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-transparent',
          )}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add stop
        </button>
        <span className="text-xs text-muted-foreground">
          {stops.length}/{MAX_STOPS} stops
        </span>
      </div>

      {chips.length > 0 && !dropoff && (
        <div className="-mx-4 overflow-x-auto px-4 pb-1 no-scrollbar" aria-label="Saved places">
          <ul className="flex gap-2">
            {chips.map((saved) => {
              const Icon = SAVED_ICON[saved.label];
              const name = saved.label === 'custom' ? saved.name ?? 'Saved' : saved.label === 'home' ? 'Home' : 'Work';
              return (
                <li key={saved.id}>
                  <button
                    type="button"
                    onClick={() => setDropoff(toPlace(saved))}
                    disabled={disabled}
                    className="inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card px-4 text-sm font-semibold transition-colors hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="h-4 w-4 text-brand" aria-hidden />
                    {name}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
