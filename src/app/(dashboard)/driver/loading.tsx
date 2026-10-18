import { Skeleton } from '@/components/ui/skeleton';

export default function DriverHomeLoading() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading your dashboard">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-52" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-3xl" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
