'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Car, MessageSquareText, RefreshCw, Star } from 'lucide-react';

import { ReviewCard } from '@/components/rating/ReviewCard';
import { Stars } from '@/components/rating/Stars';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { VEHICLES } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import type { DriverPublicProfile } from '@/types';

type State = { status: 'idle' | 'loading' } | { status: 'ready'; profile: DriverPublicProfile } | { status: 'error'; message: string };

/** Slide-over with a driver's rating breakdown and reviews, loaded on demand from /api/drivers/[id]. */
export function DriverProfileSheet({ driverId, children }: { driverId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: 'idle' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      setState({ status: 'ready', profile: await apiFetch<DriverPublicProfile>(`/api/drivers/${driverId}`) });
    } catch (error) {
      setState({ status: 'error', message: error instanceof ApiClientError ? error.message : 'Could not load this driver. Please try again.' });
    }
  }, [driverId]);

  useEffect(() => {
    if (open && state.status === 'idle') void load();
  }, [open, state.status, load]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl font-extrabold">Driver profile</SheetTitle>
          <SheetDescription>Ratings and reviews from riders.</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {(state.status === 'loading' || state.status === 'idle') && (
            <div className="space-y-4" aria-busy aria-label="Loading driver profile">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
          )}

          {state.status === 'error' && (
            <div role="alert" className="space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>{state.message}</span>
              </div>
              <Button variant="outline" className="h-11 w-full" onClick={() => void load()}>
                <RefreshCw aria-hidden /> Try again
              </Button>
            </div>
          )}

          {state.status === 'ready' && <ProfileBody profile={state.profile} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ProfileBody({ profile }: { profile: DriverPublicProfile }) {
  const { summary } = profile;
  const vehicle = VEHICLES[profile.vehicle_type];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <UserAvatar name={profile.full_name} src={profile.avatar_url} className="h-16 w-16 text-xl" />
        <div className="min-w-0">
          <p className="truncate font-display text-xl font-extrabold">{profile.full_name}</p>
          <p className="text-sm text-muted-foreground">
            {profile.total_rides.toLocaleString('en-IN')} rides · since {formatDate(profile.member_since)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm">
        <Car className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          <span className="font-semibold">{profile.vehicle_model}</span> · {profile.vehicle_color} · {vehicle.label}
        </span>
      </div>

      {summary.count === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No ratings yet — this driver is new on CabGo.</p>
      ) : (
        <section aria-label="Rating summary" className="grid grid-cols-[110px_1fr] items-center gap-4 rounded-2xl border border-border p-4">
          <div className="text-center">
            <p className="font-display text-4xl font-extrabold tabular-nums">{summary.average.toFixed(2)}</p>
            <Stars value={summary.average} />
            <p className="mt-1 text-xs text-muted-foreground">{summary.count} ratings</p>
          </div>
          <ul className="space-y-1.5" aria-label="Distribution">
            {[5, 4, 3, 2, 1].map((stars, index) => (
              <li key={stars} className="flex items-center gap-2 text-xs">
                <span className="flex w-6 items-center gap-0.5 font-semibold tabular-nums">
                  {stars}
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-success to-brand" style={{ width: `${((summary.distribution[index] ?? 0) / summary.count) * 100}%` }} />
                </div>
                <span className="w-6 text-right tabular-nums text-muted-foreground">{summary.distribution[index]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary.topTags.length > 0 && (
        <section aria-label="What riders say" className="flex flex-wrap gap-2">
          {summary.topTags.map(({ tag, count }) => (
            <span key={tag} className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
              {tag} <span className="text-muted-foreground">· {count}</span>
            </span>
          ))}
        </section>
      )}

      <section aria-label="Reviews" className="space-y-3">
        <h3 className="flex items-center gap-2 font-display text-base font-extrabold">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" aria-hidden /> Reviews
        </h3>
        {profile.reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No written reviews yet.</p>
        ) : (
          profile.reviews.map((review) => <ReviewCard key={review.id} review={review} />)
        )}
      </section>
    </div>
  );
}
