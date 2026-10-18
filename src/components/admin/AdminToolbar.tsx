import Link from 'next/link';
import { Search, X } from 'lucide-react';
import type { ReactNode } from 'react';

import { Input } from '@/components/ui/input';

interface AdminSearchProps {
  /** Page path the GET form submits to. */
  action: string;
  placeholder: string;
  q?: string;
  /** Other active filters, preserved when a search is submitted. */
  keep?: Record<string, string | undefined>;
  clearHref: string;
}

/** Server-rendered GET search box: shareable URLs, works without client JavaScript. */
export function AdminSearch({ action, placeholder, q, keep = {}, clearHref }: AdminSearchProps) {
  return (
    <form action={action} method="get" role="search" className="relative w-full sm:max-w-md">
      {Object.entries(keep).map(([name, value]) => (value ? <input key={name} type="hidden" name={name} value={value} /> : null))}
      <label htmlFor={`${action}-search`} className="sr-only">
        {placeholder}
      </label>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input id={`${action}-search`} name="q" type="search" defaultValue={q ?? ''} placeholder={placeholder} maxLength={100} className="h-12 rounded-xl pl-11 pr-12" />
      {q && (
        <Link href={clearHref} aria-label="Clear search" className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="h-4 w-4" aria-hidden />
        </Link>
      )}
    </form>
  );
}

/** Row of filters: scrolls sideways on narrow screens instead of wrapping into a tall block. */
export function FilterRow({ children }: { children: ReactNode }) {
  return <div className="-mx-4 flex flex-col items-start gap-3 overflow-x-auto px-4 sm:mx-0 sm:flex-row sm:flex-wrap sm:items-center sm:px-0">{children}</div>;
}

/** Builds `/path?a=1&b=2`, dropping defaults and empty values so URLs stay clean. */
export function buildHref(path: string, params: Record<string, string | number | undefined | null>, defaults: Record<string, string | number> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '' || value === defaults[key]) continue;
    if (key === 'page' && Number(value) <= 1) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}
