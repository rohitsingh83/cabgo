import { CheckCircle2, Hourglass, Star, Wallet } from 'lucide-react';

import { formatCurrency } from '@/lib/utils';
import type { DriverDayStats, DriverProfile } from '@/types';

/** "Today" summary tiles for the driver home (server component). */
export function DriverStatTiles({ stats, profile }: { stats: DriverDayStats; profile: Pick<DriverProfile, 'average_rating' | 'rating_count'> }) {
  const tiles = [
    { label: "Today's earnings", value: formatCurrency(stats.earnings), icon: Wallet, tone: 'bg-success/10 text-success' },
    { label: 'Trips today', value: String(stats.rides), icon: CheckCircle2, tone: 'bg-brand/10 text-brand' },
    { label: 'Awaiting payment', value: formatCurrency(stats.pending), icon: Hourglass, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    {
      label: profile.rating_count > 0 ? `Rating · ${profile.rating_count} reviews` : 'Rating',
      value: profile.rating_count > 0 ? Number(profile.average_rating).toFixed(2) : 'New',
      icon: Star,
      tone: 'bg-purple-500/10 text-purple-500',
    },
  ];

  return (
    <section aria-label="Today" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="rounded-2xl border border-border bg-card p-4">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <p className="mt-3 truncate font-display text-2xl font-extrabold tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </section>
  );
}
