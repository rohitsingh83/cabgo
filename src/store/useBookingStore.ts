'use client';

import { create } from 'zustand';

import { MAX_STOPS } from '@/lib/constants';
import type { Place, VehicleType } from '@/types';

/** A stop row. `place` is null while the rider hasn't chosen an address for it yet. */
export interface BookingStop {
  id: string;
  place: Place | null;
}

interface BookingState {
  pickup: Place | null;
  dropoff: Place | null;
  stops: BookingStop[];
  rideType: VehicleType;
  /** Code currently applied to quotes (null = none). */
  promoCode: string | null;

  setPickup: (place: Place | null) => void;
  setDropoff: (place: Place | null) => void;
  addStop: () => void;
  setStop: (id: string, place: Place | null) => void;
  removeStop: (id: string) => void;
  moveStop: (id: string, direction: -1 | 1) => void;
  swapEndpoints: () => void;
  setRideType: (type: VehicleType) => void;
  setPromoCode: (code: string | null) => void;
  reset: () => void;
}

const newId = () => `stop-${Math.random().toString(36).slice(2, 9)}`;

const initial = {
  pickup: null,
  dropoff: null,
  stops: [] as BookingStop[],
  rideType: 'sedan' as VehicleType,
  promoCode: null,
};

/** Booking form state. Lives only in memory; reset when the booking page unmounts. */
export const useBookingStore = create<BookingState>((set) => ({
  ...initial,

  setPickup: (pickup) => set({ pickup }),
  setDropoff: (dropoff) => set({ dropoff }),

  addStop: () =>
    set((state) =>
      state.stops.length >= MAX_STOPS ? state : { stops: [...state.stops, { id: newId(), place: null }] },
    ),

  setStop: (id, place) =>
    set((state) => ({ stops: state.stops.map((stop) => (stop.id === id ? { ...stop, place } : stop)) })),

  removeStop: (id) => set((state) => ({ stops: state.stops.filter((stop) => stop.id !== id) })),

  moveStop: (id, direction) =>
    set((state) => {
      const index = state.stops.findIndex((stop) => stop.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= state.stops.length) return state;
      const next = [...state.stops];
      [next[index], next[target]] = [next[target], next[index]];
      return { stops: next };
    }),

  swapEndpoints: () => set((state) => ({ pickup: state.dropoff, dropoff: state.pickup })),

  setRideType: (rideType) => set({ rideType }),
  setPromoCode: (promoCode) => set({ promoCode }),
  reset: () => set({ ...initial, stops: [] }),
}));

/** Stops that already have an address (what actually gets sent to the API). */
export const selectFilledStops = (state: Pick<BookingState, 'stops'>): Place[] =>
  state.stops.map((stop) => stop.place).filter((place): place is Place => place !== null);
