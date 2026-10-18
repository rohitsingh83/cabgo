import { Skeleton } from '@/components/ui/skeleton';

export default function DriverRatingsLoading() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading ratings">
      <div className="space-y-3">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:grid-cols-[200px_1fr]">
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="h-16 w-28" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
