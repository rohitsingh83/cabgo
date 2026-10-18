import { apiFetch } from '@/lib/api-client';
import type { LatLng, Place } from '@/types';

/** Promise wrapper around `navigator.geolocation` with human-readable errors. */
export function getBrowserPosition(options: PositionOptions = {}): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is not supported on this device'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => {
        const messages: Record<number, string> = {
          [error.PERMISSION_DENIED]: 'Location permission was denied. Enable it in your browser settings.',
          [error.POSITION_UNAVAILABLE]: 'Your location is unavailable right now.',
          [error.TIMEOUT]: 'Getting your location timed out. Please try again.',
        };
        reject(new Error(messages[error.code] ?? 'Could not get your location'));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000, ...options },
    );
  });
}

/** Coordinates → address via our server (keeps the Geocoding key private). */
export async function reverseGeocodeClient(point: LatLng): Promise<Place> {
  try {
    const { places } = await apiFetch<{ places: Place[]; configured: boolean }>(
      `/api/geocode?lat=${point.lat}&lng=${point.lng}`,
    );
    if (places[0]) return places[0];
  } catch {
    // Fall through to the coordinate label so the rider can still book.
  }
  return {
    address: `Pinned location (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`,
    lat: point.lat,
    lng: point.lng,
    name: 'Pinned location',
  };
}

/** Detect the rider's position and turn it into a bookable `Place`. */
export async function locateCurrentPlace(): Promise<Place> {
  const position = await getBrowserPosition();
  const place = await reverseGeocodeClient(position);
  return { ...place, name: place.name ?? 'Current location' };
}
