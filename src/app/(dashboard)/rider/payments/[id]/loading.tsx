import { Skeleton } from '@/components/ui/skeleton';

export default function ReceiptLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-5" aria-busy aria-label="Loading receipt">
      <Skeleton className="h-6 w-32" />
      <div className="overflow-hidden rounded-3xl border border-border bg-card">
        <Skeleton className="h-44 w-full rounded-none" />
        <div className="space-y-4 p-8">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <div className="space-y-3 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
    </div>
  );
}
