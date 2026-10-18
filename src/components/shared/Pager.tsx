import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PagerProps {
  page: number;
  totalPages: number;
  /** Builds the URL for a page number, preserving the active filters. */
  hrefFor: (page: number) => string;
  newerLabel?: string;
  olderLabel?: string;
}

/** Server-rendered Newer / Older pagination (plain links, so it works without JavaScript). */
export function Pager({ page, totalPages, hrefFor, newerLabel = 'Newer', olderLabel = 'Older' }: PagerProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between pt-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>
          <ArrowLeft aria-hidden /> {newerLabel}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>
          {olderLabel} <ArrowRight aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
