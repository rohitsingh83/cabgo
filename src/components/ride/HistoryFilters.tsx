import Link from 'next/link';
import { Search, X } from 'lucide-react';

import { SegmentedLinks } from '@/components/shared/SegmentedLinks';
import { Input } from '@/components/ui/input';

export const HISTORY_STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export const HISTORY_RANGE_FILTERS = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '365d', label: '1 year' },
] as const;

interface HistoryFiltersProps {
  status: string;
  range: string;
  q?: string;
  /** Builds a history URL for a filter combination (resets to page 1). */
  hrefFor: (next: { status?: string; range?: string; q?: string | null }) => string;
}

/**
 * Filter bar for ride history. Status and date range are plain links; search is a GET form, so the whole
 * thing is server-rendered, shareable by URL and works without client-side JavaScript.
 */
export function HistoryFilters({ status, range, q, hrefFor }: HistoryFiltersProps) {
  return (
    <div className="space-y-3">
      <form action="/rider/history" method="get" role="search" className="relative">
        {/* Preserve the other filters when a search is submitted. */}
        {status !== 'all' && <input type="hidden" name="status" value={status} />}
        {range !== 'all' && <input type="hidden" name="range" value={range} />}
        <label htmlFor="history-search" className="sr-only">
          Search trips by address
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input id="history-search" name="q" type="search" defaultValue={q ?? ''} placeholder="Search by pickup or drop-off" maxLength={100} className="h-12 rounded-xl pl-11 pr-12" />
        {q && (
          <Link href={hrefFor({ q: null })} aria-label="Clear search" className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" aria-hidden />
          </Link>
        )}
      </form>

      <div className="-mx-4 flex flex-col items-start gap-3 overflow-x-auto px-4 sm:mx-0 sm:flex-row sm:flex-wrap sm:px-0">
        <SegmentedLinks label="Filter by status" items={HISTORY_STATUS_FILTERS.map((f) => ({ label: f.label, href: hrefFor({ status: f.value }), active: f.value === status }))} />
        <SegmentedLinks label="Filter by date" items={HISTORY_RANGE_FILTERS.map((f) => ({ label: f.label, href: hrefFor({ range: f.value }), active: f.value === range }))} />
      </div>
    </div>
  );
}
