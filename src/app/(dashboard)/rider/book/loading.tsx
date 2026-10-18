import { Skeleton } from '@/components/ui/skeleton';

/** Matches the full-bleed booking layout: map area + side panel (desktop) / bottom sheet (mobile). */
export default function BookLoading() {
  return (
    <div
      className="fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] top-16 z-0 overflow-hidden bg-muted lg:bottom-0 lg:left-64 lg:flex"
      aria-busy
      aria-label="Loading booking screen"
    >
      <Skeleton className="absolute inset-0 rounded-none lg:static lg:order-2 lg:flex-1" />
      <div className="absolute inset-x-0 bottom-0 z-10 space-y-4 rounded-t-3xl border-t border-border bg-background p-4 lg:static lg:order-1 lg:w-[440px] lg:shrink-0 lg:rounded-none lg:border-r lg:border-t-0 lg:p-6">
        <Skeleton className="mx-auto h-1.5 w-10 lg:hidden" />
        <Skeleton className="hidden h-8 w-40 lg:block" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </div>
  );
}
