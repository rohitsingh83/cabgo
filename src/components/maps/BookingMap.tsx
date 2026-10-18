'use client';

import { useEffect, useRef } from 'react';
import { LocateFixed, Minus, Plus } from 'lucide-react';

import { MapCanvas, useMap } from '@/components/maps/MapCanvas';
import { useGoogleMaps } from '@/hooks/use-google-maps';
import { InteractiveStreetMap } from '@/components/maps/InteractiveStreetMap';
import { GoogleMapsStatusBadge } from '@/components/maps/GoogleMapsStatusBadge';
import {
  createCarMarker,
  createDropoffMarker,
  createPickupMarker,
  createStopMarker,
  setCarHeading,
} from '@/lib/google-maps/markers';
import type { LatLng, NearbyDriverMarker, Place } from '@/types';

interface BookingMapProps {
  pickup: Place | null;
  dropoff: Place | null;
  stops: Place[];
  /** Encoded overview polyline from the Directions API (null → draw a straight guide line). */
  polyline: string | null;
  drivers: NearbyDriverMarker[];
  /**
   * Include the cars in the camera bounds (live tracking). The map re-fits only when a car
   * appears or disappears — never on every GPS tick, so the rider can still pan freely.
   */
  fitDrivers?: boolean;
  /** Called when the rider drags the pickup pin to fine-tune it. */
  onPickupDragEnd?: (point: LatLng) => void;
  /** Re-centre on the rider's real position. */
  onLocateMe?: () => void;
  /** Extra bottom padding (px) so the route is never hidden behind the mobile bottom sheet. */
  bottomInset?: number;
  className?: string;
}

/** A car marker plus the state needed to animate it between GPS fixes. */
interface DriverMarkerEntry {
  marker: google.maps.marker.AdvancedMarkerElement;
  node: HTMLElement;
  /** Unwrapped heading (can exceed 360°) so the icon turns the short way round. */
  heading: number;
  position: LatLng;
  frame: number | null;
}

const GLIDE_MS = 1000;

/**
 * Slide a marker to its new position over ~1 s (the GPS cadence) instead of teleporting it.
 * Positions are linearly interpolated on each animation frame; a newer fix cancels the old glide.
 */
function glideTo(entry: DriverMarkerEntry, target: LatLng): void {
  if (entry.frame !== null) cancelAnimationFrame(entry.frame);
  const from = entry.position;
  const startedAt = performance.now();

  const step = (now: number) => {
    const t = Math.min(1, (now - startedAt) / GLIDE_MS);
    entry.position = { lat: from.lat + (target.lat - from.lat) * t, lng: from.lng + (target.lng - from.lng) * t };
    entry.marker.position = entry.position;
    entry.frame = t < 1 ? requestAnimationFrame(step) : null;
  };
  entry.frame = requestAnimationFrame(step);
}

/** Smallest signed rotation from `from` to `to` (degrees). */
const shortestTurn = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

const toLiteral = (point: LatLng): google.maps.LatLngLiteral => ({ lat: point.lat, lng: point.lng });

/** Renders everything on the booking map: pins, route, nearby cars, zoom controls. */
function BookingMapLayers({
  pickup,
  dropoff,
  stops,
  polyline,
  drivers,
  fitDrivers = false,
  onPickupDragEnd,
  onLocateMe,
  bottomInset = 0,
}: Omit<BookingMapProps, 'className'>) {
  const map = useMap();
  const pickupMarker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const dropoffMarker = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const stopMarkers = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const driverMarkers = useRef(new Map<string, DriverMarkerEntry>());
  const driversRef = useRef(drivers);
  driversRef.current = drivers;
  const routeLines = useRef<google.maps.Polyline[]>([]);
  const dragCallback = useRef(onPickupDragEnd);
  dragCallback.current = onPickupDragEnd;

  /* ----- pickup (draggable) ----- */
  useEffect(() => {
    if (!map) return;
    if (!pickup) {
      if (pickupMarker.current) pickupMarker.current.map = null;
      pickupMarker.current = null;
      return;
    }
    if (!pickupMarker.current) {
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: toLiteral(pickup),
        content: createPickupMarker(),
        // Only the rider's booking map lets the pickup pin be dragged.
        gmpDraggable: Boolean(dragCallback.current),
        title: dragCallback.current ? 'Drag to adjust pickup' : 'Pickup',
        zIndex: 30,
      });
      marker.addListener('dragend', () => {
        const position = marker.position;
        if (!position) return;
        const lat = typeof position.lat === 'function' ? position.lat() : position.lat;
        const lng = typeof position.lng === 'function' ? position.lng() : position.lng;
        dragCallback.current?.({ lat, lng });
      });
      pickupMarker.current = marker;
    } else {
      pickupMarker.current.position = toLiteral(pickup);
    }
  }, [map, pickup]);

  /* ----- dropoff ----- */
  useEffect(() => {
    if (!map) return;
    if (!dropoff) {
      if (dropoffMarker.current) dropoffMarker.current.map = null;
      dropoffMarker.current = null;
      return;
    }
    if (!dropoffMarker.current) {
      dropoffMarker.current = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: toLiteral(dropoff),
        content: createDropoffMarker(),
        title: 'Drop-off',
        zIndex: 20,
      });
    } else {
      dropoffMarker.current.position = toLiteral(dropoff);
    }
  }, [map, dropoff]);

  /* ----- stops (rebuilt whenever the list changes — at most 3) ----- */
  useEffect(() => {
    if (!map) return;
    stopMarkers.current.forEach((marker) => {
      marker.map = null;
    });
    stopMarkers.current = stops.map(
      (stop, index) =>
        new google.maps.marker.AdvancedMarkerElement({
          map,
          position: toLiteral(stop),
          content: createStopMarker(index + 1),
          title: `Stop ${index + 1}`,
          zIndex: 25,
        }),
    );
  }, [map, stops]);

  /* ----- route line (casing + colour; dashed guide when no polyline) ----- */
  useEffect(() => {
    if (!map) return;
    routeLines.current.forEach((line) => line.setMap(null));
    routeLines.current = [];
    if (!pickup || !dropoff) return;

    const path = polyline
      ? google.maps.geometry.encoding.decodePath(polyline)
      : [toLiteral(pickup), ...stops.map(toLiteral), toLiteral(dropoff)];

    const casing = new google.maps.Polyline({
      map,
      path,
      strokeColor: '#ffffff',
      strokeOpacity: 0.95,
      strokeWeight: 9,
      zIndex: 1,
    });
    const line = new google.maps.Polyline({
      map,
      path,
      strokeColor: '#2563eb',
      strokeOpacity: polyline ? 1 : 0.8,
      strokeWeight: 5,
      zIndex: 2,
    });
    routeLines.current = [casing, line];
  }, [map, pickup, dropoff, stops, polyline]);

  /* ----- nearby drivers (diffed so markers glide instead of flickering) ----- */
  useEffect(() => {
    if (!map) return;
    const live = driverMarkers.current;
    const seen = new Set<string>();

    drivers.forEach((driver) => {
      seen.add(driver.id);
      const existing = live.get(driver.id);
      const target = { lat: driver.lat, lng: driver.lng };
      if (existing) {
        existing.heading += shortestTurn(existing.heading, driver.heading ?? existing.heading);
        setCarHeading(existing.node, existing.heading);
        glideTo(existing, target);
        return;
      }
      const heading = driver.heading ?? 0;
      const node = createCarMarker(driver.vehicleType, heading);
      node.style.transition = 'transform 0.8s ease-out'; // smooth turns between fixes
      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: target,
        content: node,
        zIndex: 10,
      });
      live.set(driver.id, { marker, node, heading, position: target, frame: null });
    });

    live.forEach((entry, id) => {
      if (!seen.has(id)) {
        if (entry.frame !== null) cancelAnimationFrame(entry.frame);
        entry.marker.map = null;
        live.delete(id);
      }
    });
  }, [map, drivers]);

  /* ----- camera: fit the whole trip (and cars, when asked), or centre on the pickup ----- */
  // Re-fit when a car appears/disappears, not when it merely moves.
  const carCount = fitDrivers ? drivers.length : 0;
  useEffect(() => {
    if (!map) return;
    const padding = { top: 64, right: 48, left: 48, bottom: 64 + bottomInset };
    if (pickup && dropoff) {
      const bounds = new google.maps.LatLngBounds();
      [pickup, ...stops, dropoff].forEach((point) => bounds.extend(toLiteral(point)));
      if (carCount > 0) driversRef.current.forEach((driver) => bounds.extend({ lat: driver.lat, lng: driver.lng }));
      map.fitBounds(bounds, padding);
    } else if (pickup || dropoff) {
      map.panTo(toLiteral((pickup ?? dropoff) as Place));
      map.setZoom(15);
    }
  }, [map, pickup, dropoff, stops, bottomInset, carCount]);

  /* ----- cleanup on unmount ----- */
  useEffect(() => {
    const drivers = driverMarkers.current;
    return () => {
      [pickupMarker.current, dropoffMarker.current, ...stopMarkers.current].forEach((marker) => {
        if (marker) marker.map = null;
      });
      drivers.forEach(({ marker, frame }) => {
        if (frame !== null) cancelAnimationFrame(frame);
        marker.map = null;
      });
      drivers.clear();
      routeLines.current.forEach((line) => line.setMap(null));
    };
  }, []);

  const zoomBy = (delta: number) => map?.setZoom((map.getZoom() ?? 13) + delta);

  return (
    <>
      <div className="pointer-events-auto absolute left-3 top-3 z-10">
        <GoogleMapsStatusBadge />
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col gap-2 lg:bottom-auto lg:top-3">
      {onLocateMe && (
        <button
          type="button"
          onClick={onLocateMe}
          aria-label="Use my current location"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-lift transition-transform hover:bg-accent active:scale-95"
        >
          <LocateFixed className="h-5 w-5 text-brand" />
        </button>
      )}
      <div className="pointer-events-auto hidden overflow-hidden rounded-2xl border border-border bg-background shadow-lift sm:block">
        <button
          type="button"
          onClick={() => zoomBy(1)}
          aria-label="Zoom in"
          className="flex h-11 w-11 items-center justify-center hover:bg-accent"
        >
          <Plus className="h-4 w-4" />
        </button>
        <div className="h-px bg-border" />
        <button
          type="button"
          onClick={() => zoomBy(-1)}
          aria-label="Zoom out"
          className="flex h-11 w-11 items-center justify-center hover:bg-accent"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
    </div>
  </>
);
}

export function BookingMap({ className, ...layers }: BookingMapProps) {
  const { status } = useGoogleMaps();

  if (status !== 'ready') {
    return (
      <InteractiveStreetMap
        className={className}
        pickup={layers.pickup}
        dropoff={layers.dropoff}
        stops={layers.stops}
        polyline={layers.polyline}
        drivers={layers.drivers}
        onPickupDragEnd={layers.onPickupDragEnd}
        onLocateMe={layers.onLocateMe}
      />
    );
  }

  return (
    <MapCanvas className={className}>
      <BookingMapLayers {...layers} />
    </MapCanvas>
  );
}
