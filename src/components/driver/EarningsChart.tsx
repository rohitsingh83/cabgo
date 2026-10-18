'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';

import { formatCurrency } from '@/lib/utils';
import type { DriverEarningsDay } from '@/types';

/** "2026-10-18" → "18 Oct" (parsed as UTC so the label never shifts with the viewer's timezone). */
const shortDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  const point = payload?.[0]?.payload as DriverEarningsDay | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-lift">
      <p className="font-semibold">{shortDay(point.day)}</p>
      <p className="font-display text-base font-extrabold text-success">{formatCurrency(point.earnings)}</p>
      <p className="text-xs text-muted-foreground">
        {point.rides_count} ride{point.rides_count === 1 ? '' : 's'}
      </p>
    </div>
  );
}

/** Daily earnings bar chart (Recharts). Colours come from the theme tokens, so it follows dark mode. */
export function EarningsChart({ data }: { data: DriverEarningsDay[] }) {
  const hasData = data.some((day) => day.earnings > 0);
  // Thin out x-axis labels on long ranges so they never overlap.
  const interval = data.length > 31 ? Math.ceil(data.length / 8) - 1 : data.length > 10 ? 4 : 0;

  return (
    <div className="relative h-64 w-full sm:h-80" role="img" aria-label="Bar chart of daily earnings">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="earnings-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickFormatter={shortDay}
            interval={interval}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value: number) => (value >= 1000 ? `₹${Math.round(value / 100) / 10}k` : `₹${value}`)}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
          <Bar dataKey="earnings" fill="url(#earnings-bar)" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
      {!hasData && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No earnings in this period yet
        </p>
      )}
    </div>
  );
}
