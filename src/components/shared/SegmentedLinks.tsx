import Link from 'next/link';

import { cn } from '@/lib/utils';

interface SegmentedLinksProps {
  label: string;
  items: { label: string; href: string; active: boolean }[];
  className?: string;
}

/** Pill-style tab bar made of links — filters live in the URL so pages stay server-rendered. */
export function SegmentedLinks({ label, items, className }: SegmentedLinksProps) {
  return (
    <nav aria-label={label} className={cn('inline-flex rounded-xl bg-muted p-1', className)}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            item.active ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
