import { Bike, Car, CarFront, CarTaxiFront, type LucideIcon } from 'lucide-react';

import type { VehicleType } from '@/types';

/** One icon per vehicle type, shared by the selector, ride cards and driver views. */
export const VEHICLE_ICONS: Record<VehicleType, LucideIcon> = {
  bike: Bike,
  auto: CarTaxiFront,
  sedan: Car,
  suv: CarFront,
};
