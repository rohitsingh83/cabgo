'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Recharts is ~100 kB gzipped. The admin overview renders its charts below the fold, so they are
 * split into a separate chunk and loaded on the client only; skeletons of the same size hold the
 * layout so nothing jumps when the chunk arrives.
 */
export const RevenueRidesChart = dynamic(
  () => import('@/components/admin/OverviewCharts').then((module) => module.RevenueRidesChart),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full rounded-xl sm:h-80" /> },
);

export const StatusDonut = dynamic(
  () => import('@/components/admin/OverviewCharts').then((module) => module.StatusDonut),
  { ssr: false, loading: () => <Skeleton className="mx-auto h-48 w-48 rounded-full" /> },
);

export const VehicleMixChart = dynamic(
  () => import('@/components/admin/OverviewCharts').then((module) => module.VehicleMixChart),
  { ssr: false, loading: () => <Skeleton className="h-56 w-full rounded-xl" /> },
);
