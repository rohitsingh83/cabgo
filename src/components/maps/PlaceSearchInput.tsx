'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Briefcase, Clock, Home, Loader2, LocateFixed, MapPin, Search, Star, X } from 'lucide-react';

import { useDebounce } from '@/hooks/use-debounce';
import { apiFetch } from '@/lib/api-client';
import { DEMO_PLACES } from '@/lib/demo-places';
import { locateCurrentPlace } from '@/lib/geo-client';
import { isMapsKeyConfigured, loadGoogleMaps } from '@/lib/google-maps/loader';
import { cn, getErrorMessage } from '@/lib/utils';
import type { LatLng, Place, SavedPlace } from '@/types';

/** One row of the dropdown. `resolve` turns it into a concrete Place (may call the Places API). */
interface Option {
  key: string;
  group: 'current' | 'saved' | 'results' | 'popular';
  primary: string;
  secondary?: string;
  icon: ReactNode;
  resolve: () => Promise<Place | null>;
}

interface PlaceSearchInputProps {
  label: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
  placeholder?: string;
  /** Visual marker at the left of the field (dot, square, number). */
  leading?: ReactNode;
  savedPlaces?: SavedPlace[];
  /** Offer the "Use current location" row. */
  allowCurrentLocation?: boolean;
  /** Bias suggestions toward this point (usually the pickup). */
  locationBias?: LatLng | null;
  /** Called with a message when something fails (permission denied, API error …). */
  onError?: (message: string) => void;
  /** Hide the visible label (the field is still labelled for screen readers). */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

const SAVED_ICON = { home: Home, work: Briefcase, custom: Star } as const;

/**
 * Address search field (ARIA combobox).
 *
 *  • Suggestions come from the Places API (New) `AutocompleteSuggestion` with a session token
 *    (one billing session per selection).
 *  • Without a Maps key it falls back to popular Hyderabad places so the flow stays usable.
 *  • Empty field → "Use current location", saved places and popular spots.
 */
export function PlaceSearchInput({
  label,
  value,
  onChange,
  placeholder = 'Search for a place',
  leading,
  savedPlaces = [],
  allowCurrentLocation = false,
  locationBias,
  onError,
  hideLabel = true,
  disabled,
  className,
}: PlaceSearchInputProps) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const [text, setText] = useState(value?.address ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Option[]>([]);
  const [searching, setSearching] = useState(false);
  const [typed, setTypedState] = useState(false); // has the user edited the text since the last selection?
  const typedRef = useRef(false);
  const setTyped = useCallback((next: boolean) => {
    typedRef.current = next;
    setTypedState(next);
  }, []);

  const debouncedText = useDebounce(text.trim(), 250);

  // Keep the field in sync when the value is changed from outside (swap, saved place chip …).
  // While the rider is typing, `value` is null (selection invalidated) — don't wipe their input.
  useEffect(() => {
    if (value) {
      setText(value.address);
      setTyped(false);
    } else if (!typedRef.current) {
      setText('');
    }
  }, [value, setTyped]);

  // Close when clicking outside.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fail = useCallback((error: unknown) => onError?.(getErrorMessage(error)), [onError]);

  /* ----- search ----- */
  useEffect(() => {
    if (!typed || debouncedText.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);

    const run = async () => {
      let options: Option[] = [];
      try {
        if (isMapsKeyConfigured()) {
          await loadGoogleMaps();
          const { AutocompleteSuggestion, AutocompleteSessionToken } = (await google.maps.importLibrary(
            'places',
          )) as google.maps.PlacesLibrary;
          sessionToken.current ??= new AutocompleteSessionToken();

          const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: debouncedText,
            sessionToken: sessionToken.current,
            includedRegionCodes: ['in'],
            ...(locationBias
              ? { locationBias: { center: { lat: locationBias.lat, lng: locationBias.lng }, radius: 30_000 } }
              : {}),
          });

          options = suggestions.flatMap((suggestion, index) => {
            const prediction = suggestion.placePrediction;
            if (!prediction) return [];
            return [
              {
                key: `p-${prediction.placeId}-${index}`,
                group: 'results' as const,
                primary: prediction.mainText?.text ?? prediction.text.text,
                secondary: prediction.secondaryText?.text,
                icon: <MapPin className="h-4 w-4" />,
                resolve: async (): Promise<Place | null> => {
                  const place = prediction.toPlace();
                  await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] });
                  sessionToken.current = null; // session ends on selection
                  if (!place.location) return null;
                  return {
                    address: place.formattedAddress ?? prediction.text.text,
                    lat: place.location.lat(),
                    lng: place.location.lng(),
                    placeId: prediction.placeId,
                    name: place.displayName ?? prediction.mainText?.text,
                  };
                },
              },
            ];
          });
        } else {
          const needle = debouncedText.toLowerCase();
          options = DEMO_PLACES.filter(
            (place) => place.address.toLowerCase().includes(needle) || (place.name ?? '').toLowerCase().includes(needle),
          ).map((place) => ({
            key: `d-${place.name}`,
            group: 'results' as const,
            primary: place.name ?? place.address,
            secondary: place.address,
            icon: <MapPin className="h-4 w-4" />,
            resolve: async () => place,
          }));
        }
      } catch {
        // Places API unavailable (quota, key restrictions) → fall back to server geocoding.
        try {
          const { places } = await apiFetch<{ places: Place[]; configured: boolean }>(
            `/api/geocode?q=${encodeURIComponent(debouncedText)}`,
          );
          options = places.map((place, index) => ({
            key: `g-${place.placeId ?? index}`,
            group: 'results' as const,
            primary: place.name ?? place.address.split(',')[0],
            secondary: place.address,
            icon: <MapPin className="h-4 w-4" />,
            resolve: async () => place,
          }));
        } catch (error) {
          if (!cancelled) fail(error);
        }
      }
      if (!cancelled) {
        setResults(options);
        setSearching(false);
        setActive(0);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedText, typed, locationBias, fail]);

  /* ----- default options (empty field) ----- */
  const defaults = useMemo<Option[]>(() => {
    const list: Option[] = [];
    if (allowCurrentLocation) {
      list.push({
        key: 'current',
        group: 'current',
        primary: 'Use current location',
        secondary: 'Detect where you are right now',
        icon: <LocateFixed className="h-4 w-4 text-brand" />,
        resolve: () => locateCurrentPlace(),
      });
    }
    savedPlaces.forEach((place) => {
      const Icon = SAVED_ICON[place.label];
      list.push({
        key: `s-${place.id}`,
        group: 'saved',
        primary: place.label === 'custom' ? place.name ?? 'Saved place' : place.label === 'home' ? 'Home' : 'Work',
        secondary: place.address,
        icon: <Icon className="h-4 w-4" />,
        resolve: async () => ({ address: place.address, lat: place.lat, lng: place.lng, name: place.name ?? place.label }),
      });
    });
    DEMO_PLACES.slice(0, 4).forEach((place) => {
      list.push({
        key: `pop-${place.name}`,
        group: 'popular',
        primary: place.name ?? place.address,
        secondary: place.address,
        icon: <Clock className="h-4 w-4" />,
        resolve: async () => place,
      });
    });
    return list;
  }, [allowCurrentLocation, savedPlaces]);

  const showingResults = typed && debouncedText.length >= 2;
  const options = showingResults ? results : defaults;

  const select = async (option: Option) => {
    setBusy(true);
    try {
      const place = await option.resolve();
      if (place) {
        onChange(place);
        setText(place.address);
        setTyped(false);
        setOpen(false);
      }
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => (options.length === 0 ? 0 : (index + 1) % options.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => (options.length === 0 ? 0 : (index - 1 + options.length) % options.length));
    } else if (event.key === 'Enter' && open && options[active]) {
      event.preventDefault();
      void select(options[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  const clear = () => {
    setText('');
    setTyped(false);
    onChange(null);
    setOpen(true);
  };

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'mb-1.5 block text-xs font-semibold text-muted-foreground'}>
        {label}
      </label>
      <div
        className={cn(
          'flex min-h-[48px] items-center gap-3 rounded-xl border border-input bg-muted/50 px-3 transition-all focus-within:border-brand focus-within:bg-background focus-within:ring-2 focus-within:ring-brand/30',
          disabled && 'opacity-60',
        )}
      >
        {leading ?? <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
        <input
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? `${inputId}-opt-${options[active].key}` : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onFocus={(event) => {
            setOpen(true);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            setText(event.target.value);
            setTyped(true);
            setOpen(true);
            if (value) onChange(null); // editing invalidates the previous selection
          }}
          onKeyDown={onKeyDown}
          className="h-12 min-w-0 flex-1 truncate bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        {busy || searching ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-label="Searching" />
        ) : text ? (
          <button
            type="button"
            onClick={clear}
            aria-label={`Clear ${label}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-lift animate-fade-in"
        >
          {options.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {searching ? 'Searching…' : showingResults ? 'No places found. Try a different search.' : 'Start typing an address'}
            </li>
          )}
          {options.map((option, index) => {
            const heading =
              index === 0 || options[index - 1].group !== option.group
                ? { saved: 'Saved places', popular: 'Popular places', results: 'Suggestions', current: '' }[option.group]
                : '';
            return (
              <li key={option.key} role="presentation">
                {heading && (
                  <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{heading}</p>
                )}
                <div
                  id={`${inputId}-opt-${option.key}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(event) => event.preventDefault() /* keep focus in the input */}
                  onClick={() => void select(option)}
                  className={cn(
                    'flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3 py-2',
                    index === active && 'bg-accent',
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {option.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{option.primary}</span>
                    {option.secondary && <span className="block truncate text-xs text-muted-foreground">{option.secondary}</span>}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
