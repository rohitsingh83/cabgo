import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div aria-busy aria-label="Loading profile">
      <div className="mb-6 space-y-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          <div className="flex items-center gap-5 rounded-2xl border border-border bg-card p-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-6 w-36" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[84px] w-full rounded-2xl" />
            <Skeleton className="h-[84px] w-full rounded-2xl" />
          </div>
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
