import { Loader } from '@googlemaps/js-api-loader';

/**
 * Browser-side Google Maps bootstrap. The script is injected once, on demand, and every
 * library we need (maps, marker, places, geometry) is imported through the same loader
 * promise so components can simply `await loadGoogleMaps()`.
 */

export function getMapsApiKey(): string {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('cabgo_google_maps_api_key');
    if (local && looksLikeGoogleKey(local)) return local;
  }
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
}

export const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
/** Advanced Markers require a Map ID. `DEMO_MAP_ID` works for development. */
export const MAPS_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';

/** Google API keys look like `AIza…` (39 chars). Placeholders (xxxx, REPLACE_ME …) must not trigger a load. */
export function looksLikeGoogleKey(key: string | undefined): boolean {
  return Boolean(key && /^AIza[\w-]{30,}$/.test(key) && !key.includes('xxxxxxxx'));
}

/** True when a real-looking key is present (the .env.example placeholder doesn't count). */
export function isMapsKeyConfigured(): boolean {
  return looksLikeGoogleKey(getMapsApiKey());
}

let loadPromise: Promise<void> | null = null;

export function resetGoogleMapsLoader(): void {
  loadPromise = null;
}

export function loadGoogleMaps(forceKey?: string): Promise<void> {
  const activeKey = forceKey || getMapsApiKey();
  if (!looksLikeGoogleKey(activeKey)) {
    return Promise.reject(new Error('Google Maps API key is not configured'));
  }
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser'));
  }

  if (!loadPromise) {
    const loader = new Loader({ apiKey: activeKey, version: 'weekly', language: 'en', region: 'IN' });
    loadPromise = Promise.all([
      loader.importLibrary('maps'),
      loader.importLibrary('marker'),
      loader.importLibrary('places'),
      loader.importLibrary('geometry'),
    ])
      .then(() => undefined)
      .catch((error: unknown) => {
        loadPromise = null; // allow a retry after a transient network failure
        throw error instanceof Error ? error : new Error('Failed to load Google Maps');
      });
  }
  return loadPromise;
}
