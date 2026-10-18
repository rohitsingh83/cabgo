'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from 'next-themes';

import { Skeleton } from '@/components/ui/skeleton';
import { useGoogleMaps } from '@/hooks/use-google-maps';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/constants';
import { MAPS_MAP_ID } from '@/lib/google-maps/loader';
import { InteractiveStreetMap } from '@/components/maps/InteractiveStreetMap';
import { cn } from '@/lib/utils';
import type { LatLng } from '@/types';

const MapContext = createContext<google.maps.Map | null>(null);

/** Access the Google Map instance from any child of <MapCanvas>. Null until the map exists. */
export function useMap(): google.maps.Map | null {
  return useContext(MapContext);
}

interface MapCanvasProps {
  className?: string;
  center?: LatLng;
  zoom?: number;
  children?: ReactNode;
}

interface InnerProps extends MapCanvasProps {
  dark: boolean;
}

function MapCanvasInner({ className, center, zoom, children, dark }: InnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const instance = new google.maps.Map(container, {
      center: center ?? DEFAULT_MAP_CENTER,
      zoom: zoom ?? DEFAULT_MAP_ZOOM,
      mapId: MAPS_MAP_ID,
      // colorScheme is read once at construction → the wrapper remounts this component on theme change.
      colorScheme: dark ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
      disableDefaultUI: true,
      zoomControl: false,
      gestureHandling: 'greedy',
      clickableIcons: false,
    });
    setMap(instance);

    return () => {
      google.maps.event.clearInstanceListeners(instance);
      setMap(null);
    };
    // The map is created once per mount; later center/zoom changes are applied by consumers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark]);

  return (
    <div className={cn('relative h-full w-full', className)}>
      <div ref={containerRef} className="absolute inset-0" role="application" aria-label="Map" />
      {!map && <Skeleton className="absolute inset-0 rounded-none" />}
      <MapContext.Provider value={map}>{map ? children : null}</MapContext.Provider>
    </div>
  );
}

/**
 * Themed Google Map. Handles script loading, graceful fallbacks, and remounting when the
 * user flips light/dark (Google only accepts `colorScheme` at construction time).
 */
export function MapCanvas(props: MapCanvasProps) {
  const { status } = useGoogleMaps();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (status === 'unconfigured' || status === 'error') {
    return <InteractiveStreetMap className={props.className} center={props.center} zoom={props.zoom} />;
  }
  if (status === 'loading' || !mounted) {
    return <Skeleton className="h-full w-full rounded-none" />;
  }

  const dark = resolvedTheme === 'dark';
  return <MapCanvasInner key={dark ? 'dark' : 'light'} dark={dark} {...props} />;
}
