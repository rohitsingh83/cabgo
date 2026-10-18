import { Skeleton } from '@/components/ui/skeleton';

export default function SupportLoading() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading support">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-12 w-36 rounded-xl" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-12 w-72 max-w-full rounded-xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[84px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
