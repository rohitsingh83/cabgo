'use client';

import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';

import { formatCurrency } from '@/lib/utils';
import type { AdminDailyStat, RideStatus, VehicleType } from '@/types';

const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 } as const;

/** "2026-10-18" → "18 Oct" (parsed as UTC so the label never shifts with the viewer's timezone). */
const shortDay = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const compactMoney = (value: number) => (value >= 100000 ? `₹${Math.round(value / 10000) / 10}L` : value >= 1000 ? `₹${Math.round(value / 100) / 10}k` : `₹${value}`);

function TooltipCard({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-lift">{children}</div>;
}

function DailyTooltip({ active, payload }: TooltipProps<number, string>) {
  const point = payload?.[0]?.payload as AdminDailyStat | undefined;
  if (!active || !point) return null;
  return (
    <TooltipCard>
      <p className="font-semibold">{shortDay(point.day)}</p>
      <p className="font-display text-base font-extrabold text-success">{formatCurrency(point.revenue)}</p>
      <p className="text-xs text-muted-foreground">
        {point.rides_count} rides · {point.completed_count} completed · {point.cancelled_count} cancelled
      </p>
    </TooltipCard>
  );
}

/** Revenue (area, left axis) against ride volume (line, right axis) per day. */
export function RevenueRidesChart({ data }: { data: AdminDailyStat[] }) {
  const hasData = data.some((day) => day.revenue > 0 || day.rides_count > 0);
  const interval = data.length > 31 ? Math.ceil(data.length / 8) - 1 : data.length > 10 ? 4 : 0;

  return (
    <div className="relative h-72 w-full sm:h-80" role="img" aria-label="Chart of daily revenue and ride count">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="admin-revenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis dataKey="day" tickFormatter={shortDay} interval={interval} tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <YAxis yAxisId="money" tickLine={false} axisLine={false} width={52} tickFormatter={compactMoney} tick={AXIS_TICK} />
          <YAxis yAxisId="rides" orientation="right" tickLine={false} axisLine={false} width={32} allowDecimals={false} tick={AXIS_TICK} />
          <Tooltip content={<DailyTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
          <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Area yAxisId="money" type="monotone" dataKey="revenue" name="Revenue" stroke="#22C55E" strokeWidth={2} fill="url(#admin-revenue)" />
          <Line yAxisId="rides" type="monotone" dataKey="rides_count" name="Rides" stroke="#2563EB" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
      {!hasData && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No activity in this period yet</p>}
    </div>
  );
}

const STATUS_COLOR: Record<RideStatus, string> = {
  completed: '#22C55E',
  cancelled: '#EF4444',
  in_progress: '#2563EB',
  driver_arriving: '#38BDF8',
  accepted: '#818CF8',
  searching: '#F59E0B',
  requested: '#A3A3A3',
};
const STATUS_LABEL: Record<RideStatus, string> = {
  completed: 'Completed',
  cancelled: 'Cancelled',
  in_progress: 'In progress',
  driver_arriving: 'Driver arriving',
  accepted: 'Accepted',
  searching: 'Searching',
  requested: 'Requested',
};

/** Donut of ride outcomes with a legend that stays readable on mobile. */
export function StatusDonut({ data }: { data: { key: RideStatus; count: number }[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">No rides in this period yet</p>;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-48 w-48 shrink-0" role="img" aria-label="Donut chart of ride statuses">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="count" nameKey="key" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
              {data.map((item) => (
                <Cell key={item.key} fill={STATUS_COLOR[item.key]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-extrabold tabular-nums">{total.toLocaleString('en-IN')}</span>
          <span className="text-xs text-muted-foreground">rides</span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-1">
        {data.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: STATUS_COLOR[item.key] }} />
            <span className="truncate">{STATUS_LABEL[item.key]}</span>
            <span className="ml-auto font-semibold tabular-nums">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const VEHICLE_LABEL: Record<VehicleType, string> = { bike: 'Bike', auto: 'Auto', sedan: 'Sedan', suv: 'SUV' };

/** Horizontal bars: completed rides per vehicle class. */
export function VehicleMixChart({ data }: { data: { key: VehicleType; count: number }[] }) {
  const rows = data.map((item) => ({ name: VEHICLE_LABEL[item.key], count: item.count }));
  const hasData = rows.some((row) => row.count > 0);
  return (
    <div className="relative h-56 w-full" role="img" aria-label="Bar chart of completed rides by vehicle type">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="admin-vehicle" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#22C55E" />
            </linearGradient>
          </defs>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS_TICK} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={52} tick={{ ...AXIS_TICK, fontSize: 12 }} />
          <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))' }} formatter={(value: number) => [`${value} rides`, 'Completed']} />
          <Bar dataKey="count" fill="url(#admin-vehicle)" radius={[0, 6, 6, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
      {!hasData && <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No completed rides in this period yet</p>}
    </div>
  );
}
