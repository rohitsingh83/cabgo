import { Skeleton } from '@/components/ui/skeleton';

export default function TicketLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6" aria-busy aria-label="Loading ticket">
      <Skeleton className="h-6 w-28" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-4 w-56" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}
