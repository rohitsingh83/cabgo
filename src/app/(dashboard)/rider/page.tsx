import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Briefcase, CarFront, Home, MapPin, Plus, Route as RouteIcon, Star, Wallet } from 'lucide-react';

import { ActiveRideBanner } from '@/components/ride/ActiveRideBanner';
import { PaymentDueBanner } from '@/components/payment/PaymentDueBanner';
import { RideCard } from '@/components/ride/RideCard';
import { buttonVariants } from '@/components/ui/button';
import { Reveal } from '@/components/shared/Reveal';
import { EmptyState } from '@/components/shared/EmptyState';
import { requireRole } from '@/lib/auth';
import { getPaymentDues } from '@/lib/payments/service';
import { getActiveRideForRider, getSavedPlacesForUser } from '@/lib/rides/queries';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatCurrency, formatDistance } from '@/lib/utils';
import type { SavedPlace } from '@/types';

export const metadata: Metadata = { title: 'Home' };
export const dynamic = 'force-dynamic';

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Kolkata';

/** "Good morning" etc. based on the hour in the configured timezone (server may run in UTC). */
function greeting(now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TIMEZONE }).format(now));
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

const SAVED_ICON = { home: Home, work: Briefcase, custom: Star } as const;
const savedName = (place: SavedPlace) => (place.label === 'home' ? 'Home' : place.label === 'work' ? 'Work' : place.name ?? 'Saved');

export default async function RiderHomePage() {
  const user = await requireRole('rider');
  const db = createSupabaseAdminClient();

  const [activeRide, dues, savedPlaces, completedResult, recentResult] = await Promise.all([
    getActiveRideForRider(user.id),
    getPaymentDues(user.id, 5),
    getSavedPlacesForUser(user.id),
    db.from('rides').select('final_fare, estimated_fare, distance_km').eq('rider_id', user.id).eq('status', 'completed').limit(1000),
    db.from('rides').select('*').eq('rider_id', user.id).order('created_at', { ascending: false }).limit(3),
  ]);
  if (completedResult.error) throw new Error(`Failed to load ride stats: ${completedResult.error.message}`);
  if (recentResult.error) throw new Error(`Failed to load recent rides: ${recentResult.error.message}`);

  const completed = completedResult.data ?? [];
  const totalSpent = completed.reduce((sum, ride) => sum + Number(ride.final_fare ?? ride.estimated_fare), 0);
  const totalKm = completed.reduce((sum, ride) => sum + Number(ride.distance_km), 0);
  const recent = recentResult.data ?? [];
  const firstName = user.full_name.split(' ')[0] ?? user.full_name;

  const stats = [
    { label: 'Completed rides', value: completed.length.toLocaleString('en-IN'), icon: CarFront, tone: 'bg-brand/10 text-brand' },
    { label: 'Total spent', value: formatCurrency(totalSpent), icon: Wallet, tone: 'bg-success/10 text-success' },
    { label: 'Distance travelled', value: formatDistance(totalKm), icon: RouteIcon, tone: 'bg-purple-500/10 text-purple-500' },
  ];

  return (
    <div className="space-y-8">
      <Reveal>
        <p className="text-sm font-medium text-muted-foreground">{greeting()},</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{firstName} 👋</h1>
      </Reveal>

      {dues.length > 0 && (
        <Reveal delay={0.04}>
          <PaymentDueBanner dues={dues} />
        </Reveal>
      )}

      {activeRide && (
        <Reveal delay={0.05}>
          <ActiveRideBanner ride={activeRide} />
        </Reveal>
      )}

      {/* Quick book */}
      <Reveal delay={0.08}>
        <Link
          href="/rider/book"
          className="group relative block overflow-hidden rounded-3xl bg-black p-6 text-white shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border dark:border-white/10 sm:p-8"
        >
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/40 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute -bottom-20 left-10 h-56 w-56 rounded-full bg-success/25 blur-3xl" />
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-grid-dark opacity-60 [background-size:36px_36px] [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />

          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Book a ride</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Where to today?</h2>
            <div className="mt-6 flex min-h-[56px] items-center gap-3 rounded-2xl bg-white px-4 text-black transition-transform group-hover:scale-[1.01]">
              <MapPin className="h-5 w-5 text-brand" aria-hidden />
              <span className="flex-1 text-base font-medium text-neutral-500">Enter your destination</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
                <ArrowRight className="h-5 w-5" aria-hidden />
              </span>
            </div>
          </div>
        </Link>
      </Reveal>

      {/* Saved places */}
      <Reveal delay={0.1}>
        <section aria-labelledby="saved-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="saved-heading" className="font-display text-lg font-extrabold">
              Quick destinations
            </h2>
            <Link href="/rider/profile#saved-places" className="text-sm font-semibold text-brand hover:underline">
              Manage
            </Link>
          </div>
          {savedPlaces.length === 0 ? (
            <Link
              href="/rider/profile#saved-places"
              className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-dashed border-border px-4 text-sm text-muted-foreground transition-colors hover:border-brand hover:text-foreground"
            >
              <Plus className="h-5 w-5" aria-hidden /> Save Home and Work for one-tap booking
            </Link>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {savedPlaces.map((place) => {
                const Icon = SAVED_ICON[place.label];
                return (
                  <li key={place.id}>
                    <Link
                      href={`/rider/book?to=${place.id}`}
                      className="inline-flex min-h-[48px] items-center gap-2.5 rounded-full border border-border bg-card px-5 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon className="h-4 w-4 text-brand" aria-hidden />
                      <span>{savedName(place)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </Reveal>

      {/* Stats */}
      <Reveal delay={0.12}>
        <section aria-label="Your stats" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-2xl font-extrabold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </section>
      </Reveal>

      {/* Recent rides */}
      <Reveal delay={0.14}>
        <section aria-labelledby="recent-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="recent-heading" className="font-display text-lg font-extrabold">
              Recent rides
            </h2>
            {recent.length > 0 && (
              <Link href="/rider/history" className="text-sm font-semibold text-brand hover:underline">
                View all
              </Link>
            )}
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={CarFront}
              title="No rides yet"
              description="Your trips will show up here. Book your first ride in under a minute."
              action={
                <Link href="/rider/book" className={buttonVariants({ variant: 'brand', size: 'lg' })}>
                  Book a ride
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {recent.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))}
            </div>
          )}
        </section>
      </Reveal>
    </div>
  );
}
