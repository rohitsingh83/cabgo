import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BookingExperience } from '@/components/ride/BookingExperience';
import { requireRole } from '@/lib/auth';
import { getActiveRideForRider, getSavedPlacesForUser } from '@/lib/rides/queries';
import { uuidSchema } from '@/lib/validations';
import type { Place } from '@/types';

export const metadata: Metadata = { title: 'Book a ride' };
export const dynamic = 'force-dynamic';

interface BookPageProps {
  searchParams: { to?: string | string[] };
}

export default async function BookPage({ searchParams }: BookPageProps) {
  const user = await requireRole('rider');

  // One live ride at a time: jump straight back to it.
  const [activeRide, savedPlaces] = await Promise.all([getActiveRideForRider(user.id), getSavedPlacesForUser(user.id)]);
  if (activeRide) redirect(`/rider/tracking/${activeRide.id}`);

  // `?to=<savedPlaceId>` preselects a saved place as the drop-off.
  const toParam = Array.isArray(searchParams.to) ? searchParams.to[0] : searchParams.to;
  const target = toParam && uuidSchema.safeParse(toParam).success ? savedPlaces.find((place) => place.id === toParam) : undefined;
  const initialDropoff: Place | null = target
    ? { address: target.address, lat: target.lat, lng: target.lng, name: target.name ?? (target.label === 'home' ? 'Home' : 'Work') }
    : null;

  return <BookingExperience savedPlaces={savedPlaces} initialDropoff={initialDropoff} />;
}
