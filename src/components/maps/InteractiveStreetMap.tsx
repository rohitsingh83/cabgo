'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, LocateFixed, Minus, Navigation, Plus } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import type { LatLng, NearbyDriverMarker, Place } from '@/types';
import { GoogleMapsStatusBadge } from '@/components/maps/GoogleMapsStatusBadge';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM } from '@/lib/constants';

interface InteractiveStreetMapProps {
  center?: LatLng;
  zoom?: number;
  pickup?: Place | null;
  dropoff?: Place | null;
  stops?: Place[];
  polyline?: string | null;
  drivers?: NearbyDriverMarker[];
  onPickupDragEnd?: (point: LatLng) => void;
  onLocateMe?: () => void;
  className?: string;
}

/** Web Mercator projection helpers */
function latLngToWorld(lat: number, lng: number): { x: number; y: number } {
  const sinY = Math.sin((lat * Math.PI) / 180);
  const clampedSinY = Math.min(Math.max(sinY, -0.9999), 0.9999);
  return {
    x: 256 * (0.5 + lng / 360),
    y: 256 * (0.5 - Math.log((1 + clampedSinY) / (1 - clampedSinY)) / (4 * Math.PI)),
  };
}

function worldToLatLng(x: number, y: number): LatLng {
  const lng = (x / 256 - 0.5) * 360;
  const yNorm = 0.5 - y / 256;
  const lat = (90 - (360 * Math.atan(Math.exp(-yNorm * 2 * Math.PI))) / Math.PI);
  return { lat, lng };
}

export function InteractiveStreetMap({
  center = DEFAULT_MAP_CENTER,
  zoom = DEFAULT_MAP_ZOOM,
  pickup,
  dropoff,
  stops = [],
  drivers = [],
  onPickupDragEnd,
  onLocateMe,
  className,
}: InteractiveStreetMapProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const containerRef = useRef<HTMLDivElement>(null);

  // Map viewport state
  const [currentCenter, setCurrentCenter] = useState<LatLng>(center);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);
  const [mapLayer, setMapLayer] = useState<'streets' | 'satellite' | 'terrain'>('streets');
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; center: LatLng } | null>(null);

  // Resize listener
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setViewportSize({ width: el.clientWidth || 800, height: el.clientHeight || 600 });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Update center when pickup or dropoff changes
  useEffect(() => {
    if (pickup && dropoff) {
      setCurrentCenter({
        lat: (pickup.lat + dropoff.lat) / 2,
        lng: (pickup.lng + dropoff.lng) / 2,
      });
      // Rough distance zoom calculation
      const dist = Math.hypot(pickup.lat - dropoff.lat, pickup.lng - dropoff.lng);
      if (dist > 0.15) setCurrentZoom(11);
      else if (dist > 0.05) setCurrentZoom(13);
      else setCurrentZoom(14);
    } else if (pickup) {
      setCurrentCenter({ lat: pickup.lat, lng: pickup.lng });
    }
  }, [pickup, dropoff]);

  // Screen coordinate conversion
  const project = useCallback(
    (lat: number, lng: number) => {
      const scale = Math.pow(2, currentZoom);
      const worldCenter = latLngToWorld(currentCenter.lat, currentCenter.lng);
      const worldPoint = latLngToWorld(lat, lng);
      return {
        x: viewportSize.width / 2 + (worldPoint.x - worldCenter.x) * scale,
        y: viewportSize.height / 2 + (worldPoint.y - worldCenter.y) * scale,
      };
    },
    [currentCenter, currentZoom, viewportSize]
  );

  const unproject = useCallback(
    (screenX: number, screenY: number): LatLng => {
      const scale = Math.pow(2, currentZoom);
      const worldCenter = latLngToWorld(currentCenter.lat, currentCenter.lng);
      const worldX = worldCenter.x + (screenX - viewportSize.width / 2) / scale;
      const worldY = worldCenter.y + (screenY - viewportSize.height / 2) / scale;
      return worldToLatLng(worldX, worldY);
    },
    [currentCenter, currentZoom, viewportSize]
  );

  // Mouse / Touch drag to pan
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      center: { ...currentCenter },
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const scale = Math.pow(2, currentZoom);
    const startWorld = latLngToWorld(dragStartRef.current.center.lat, dragStartRef.current.center.lng);
    const newWorld = {
      x: startWorld.x - dx / scale,
      y: startWorld.y - dy / scale,
    };
    setCurrentCenter(worldToLatLng(newWorld.x, newWorld.y));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    dragStartRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.5 : -0.5;
    setCurrentZoom((z) => Math.min(18, Math.max(10, z + delta)));
  };

  // Tile rendering math (Live Google Maps tile network)
  const tiles = useMemo(() => {
    const worldCenter = latLngToWorld(currentCenter.lat, currentCenter.lng);
    const tileZoom = Math.floor(currentZoom);
    const tileZoomScale = Math.pow(2, currentZoom - tileZoom);

    const centerTileX = (worldCenter.x * Math.pow(2, tileZoom)) / 256;
    const centerTileY = (worldCenter.y * Math.pow(2, tileZoom)) / 256;

    const startX = Math.floor(centerTileX - (viewportSize.width / 2 / (256 * tileZoomScale)));
    const endX = Math.ceil(centerTileX + (viewportSize.width / 2 / (256 * tileZoomScale)));
    const startY = Math.floor(centerTileY - (viewportSize.height / 2 / (256 * tileZoomScale)));
    const endY = Math.ceil(centerTileY + (viewportSize.height / 2 / (256 * tileZoomScale)));

    const maxTile = Math.pow(2, tileZoom);
    const result: Array<{ key: string; url: string; fallbackUrl: string; left: number; top: number; size: number }> = [];

    const tileSize = 256 * tileZoomScale;

    // Google Maps tile servers:
    // lyrs=m: Standard Google roadmap (streets, traffic lines, landmarks)
    // lyrs=y: Google Hybrid (Satellite imagery with road overlays & labels)
    // lyrs=p: Google Terrain (Topographical contours & streets)
    let lyrs = 'm';
    if (mapLayer === 'satellite') lyrs = 'y';
    else if (mapLayer === 'terrain') lyrs = 'p';

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        if (y < 0 || y >= maxTile) continue;
        const wrappedX = ((x % maxTile) + maxTile) % maxTile;
        const s = [0, 1, 2, 3][Math.abs(x + y) % 4];

        const url = `https://mt${s}.google.com/vt/lyrs=${lyrs}&x=${wrappedX}&y=${y}&z=${tileZoom}&hl=en`;
        const fallbackUrl = `https://${['a', 'b', 'c', 'd'][s]}.basemaps.cartocdn.com/rastertiles/voyager/${tileZoom}/${wrappedX}/${y}@2x.png`;

        const left = viewportSize.width / 2 + (x - centerTileX) * tileSize;
        const top = viewportSize.height / 2 + (y - centerTileY) * tileSize;

        result.push({
          key: `${mapLayer}/${tileZoom}/${wrappedX}/${y}`,
          url,
          fallbackUrl,
          left,
          top,
          size: tileSize,
        });
      }
    }
    return result;
  }, [currentCenter, currentZoom, viewportSize, mapLayer]);

  // Points on screen
  const pickupPoint = pickup ? project(pickup.lat, pickup.lng) : null;
  const dropoffPoint = dropoff ? project(dropoff.lat, dropoff.lng) : null;
  const stopPoints = stops.map((s) => ({ ...project(s.lat, s.lng), name: s.name || s.address }));

  // Draggable pickup logic
  const handlePickupPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!onPickupDragEnd) return;
    let lastPoint = pickup ? { lat: pickup.lat, lng: pickup.lng } : currentCenter;

    const onMove = (moveEvt: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const screenX = moveEvt.clientX - rect.left;
      const screenY = moveEvt.clientY - rect.top;
      lastPoint = unproject(screenX, screenY);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onPickupDragEnd(lastPoint);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      className={cn(
        'relative h-full w-full select-none overflow-hidden bg-muted touch-none cursor-grab active:cursor-grabbing',
        className
      )}
      style={{ userSelect: 'none' }}
    >
      {/* Map Tile Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.key}
            src={t.url}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute select-none pointer-events-none"
            style={{
              left: `${t.left}px`,
              top: `${t.top}px`,
              width: `${t.size}px`,
              height: `${t.size}px`,
              filter: isDark ? 'brightness(0.95) contrast(1.05)' : undefined,
            }}
          />
        ))}
      </div>

      {/* SVG Route Layer */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none z-10">
        {pickupPoint && dropoffPoint && (
          <>
            {/* Soft casing */}
            <path
              d={`M ${pickupPoint.x} ${pickupPoint.y} ${stopPoints
                .map((p) => `L ${p.x} ${p.y}`)
                .join(' ')} L ${dropoffPoint.x} ${dropoffPoint.y}`}
              fill="none"
              stroke={isDark ? '#1e3a8a' : '#93c5fd'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />
            {/* Active route line */}
            <path
              d={`M ${pickupPoint.x} ${pickupPoint.y} ${stopPoints
                .map((p) => `L ${p.x} ${p.y}`)
                .join(' ')} L ${dropoffPoint.x} ${dropoffPoint.y}`}
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}
      </svg>

      {/* Nearby Driver Cars */}
      <div className="absolute inset-0 pointer-events-none z-20">
        {drivers.map((driver) => {
          const pt = project(driver.lat, driver.lng);
          if (pt.x < -50 || pt.x > viewportSize.width + 50 || pt.y < -50 || pt.y > viewportSize.height + 50) {
            return null;
          }
          return (
            <div
              key={driver.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
              style={{
                left: `${pt.x}px`,
                top: `${pt.y}px`,
                transform: `translate(-50%, -50%) rotate(${driver.heading ?? 0}deg)`,
              }}
            >
              <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-background border border-border shadow-md">
                <Navigation className="h-4 w-4 text-primary fill-primary transform -rotate-45" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Stop Markers */}
      {stopPoints.map((pt, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-30"
          style={{ left: `${pt.x}px`, top: `${pt.y}px` }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-lg border-2 border-white">
            {i + 1}
          </div>
        </div>
      ))}

      {/* Pickup Marker */}
      {pickupPoint && (
        <div
          onPointerDown={handlePickupPointerDown}
          className={cn(
            'absolute -translate-x-1/2 -translate-y-full z-40 transition-transform',
            onPickupDragEnd ? 'cursor-grab active:cursor-grabbing hover:scale-110' : 'pointer-events-none'
          )}
          style={{ left: `${pickupPoint.x}px`, top: `${pickupPoint.y}px` }}
        >
          <div className="relative flex flex-col items-center">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xl border border-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
              <span>Pickup</span>
            </div>
            <div className="h-3 w-0.5 bg-emerald-700" />
            <div className="h-2 w-2 rounded-full bg-emerald-800 shadow-sm" />
          </div>
        </div>
      )}

      {/* Dropoff Marker */}
      {dropoffPoint && (
        <div
          className="absolute -translate-x-1/2 -translate-y-full pointer-events-none z-40"
          style={{ left: `${dropoffPoint.x}px`, top: `${dropoffPoint.y}px` }}
        >
          <div className="relative flex flex-col items-center">
            <div className="rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xl border border-white/40">
              Drop-off
            </div>
            <div className="h-3 w-0.5 bg-rose-700" />
            <div className="h-2 w-2 rounded-full bg-rose-800 shadow-sm" />
          </div>
        </div>
      )}

      {/* Top Left: Google Maps Configuration & Status Badge */}
      <div className="absolute left-3 top-3 z-30 pointer-events-auto">
        <GoogleMapsStatusBadge />
      </div>

      {/* Top Right Zoom, Locate, and Layer Controls */}
      <div className="absolute right-3 top-3 z-30 flex flex-col gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => {
            setMapLayer((prev) => (prev === 'streets' ? 'satellite' : prev === 'satellite' ? 'terrain' : 'streets'));
          }}
          title={`Switch map view (current: ${mapLayer})`}
          aria-label="Toggle map layer"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-transform hover:bg-accent active:scale-95"
        >
          <Layers className="h-4 w-4 text-primary" />
        </button>
        {onLocateMe && (
          <button
            type="button"
            onClick={onLocateMe}
            aria-label="Locate me"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-md transition-transform hover:bg-accent active:scale-95"
          >
            <LocateFixed className="h-4 w-4 text-primary" />
          </button>
        )}
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-md">
          <button
            type="button"
            onClick={() => setCurrentZoom((z) => Math.min(18, z + 1))}
            aria-label="Zoom in"
            className="flex h-10 w-10 items-center justify-center hover:bg-accent"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={() => setCurrentZoom((z) => Math.max(10, z - 1))}
            aria-label="Zoom out"
            className="flex h-10 w-10 items-center justify-center hover:bg-accent"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
