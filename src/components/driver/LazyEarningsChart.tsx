'use client';

import dynamic from 'next/dynamic';

import { Skeleton } from '@/components/ui/skeleton';

/** Client-only, code-split wrapper around the Recharts earnings chart (keeps Recharts out of the first load). */
export const EarningsChart = dynamic(
  () => import('@/components/driver/EarningsChart').then((module) => module.EarningsChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl sm:h-80" /> },
);
