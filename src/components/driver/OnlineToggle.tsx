'use client';

import { Loader2, Lock, MapPinOff, Power } from 'lucide-react';

import { cn } from '@/lib/utils';

interface OnlineToggleProps {
  online: boolean;
  verified: boolean;
  /** On a trip: the driver can't go offline. */
  onTrip: boolean;
  toggling: boolean;
  /** Message from the location watcher (permission denied, no signal …). */
  locationError: string | null;
  onToggle: (next: boolean) => void;
}

/** The big go-online switch. Dark + green glow when live, quiet card when offline. */
export function OnlineToggle({ online, verified, onTrip, toggling, locationError, onToggle }: OnlineToggleProps) {
  const disabled = toggling || !verified || (online && onTrip);

  const title = !verified ? 'Verification required' : onTrip ? 'On a trip' : online ? "You're online" : "You're offline";
  const subtitle = !verified
    ? 'You can go online once your account is approved.'
    : onTrip
      ? 'Finish your current trip to go offline.'
      : online
        ? 'Waiting for ride requests near you…'
        : 'Go online to start receiving ride requests.';

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-3xl border p-5 transition-colors sm:p-6',
        online ? 'border-success/40 bg-black text-white' : 'border-border bg-card',
      )}
      aria-label="Availability"
    >
      {online && (
        <>
          <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-success/30 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-brand/25 blur-3xl" />
        </>
      )}

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span
            className={cn(
              'relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
              online ? 'bg-success text-white shadow-glow-green' : 'bg-muted text-muted-foreground',
            )}
          >
            {!verified ? <Lock className="h-6 w-6" aria-hidden /> : <Power className="h-6 w-6" aria-hidden />}
            {online && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-2xl border-2 border-success" />}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold tracking-tight">{title}</h2>
            <p className={cn('text-sm', online ? 'text-white/70' : 'text-muted-foreground')}>{subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={online}
          aria-label={online ? 'Go offline' : 'Go online'}
          disabled={disabled}
          onClick={() => onToggle(!online)}
          className={cn(
            'relative inline-flex h-11 w-[84px] shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            online ? 'bg-success' : 'bg-muted-foreground/30',
          )}
        >
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow transition-transform duration-300',
              online ? 'translate-x-[40px]' : 'translate-x-0',
            )}
          >
            {toggling && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          </span>
        </button>
      </div>

      {locationError && (
        <p role="alert" className="relative mt-4 flex items-start gap-2 rounded-xl bg-amber-500/15 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
          <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {locationError}
        </p>
      )}
    </section>
  );
}
