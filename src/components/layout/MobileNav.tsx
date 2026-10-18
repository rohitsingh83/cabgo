'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Ellipsis } from 'lucide-react';
import { motion } from 'framer-motion';

import type { ShellUser } from '@/components/layout/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { isNavItemActive, NAVIGATION, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

/**
 * Bottom tab bar for < lg screens. Primary destinations sit in the bar; everything else
 * lives behind "More". Every target is at least 44px × 44px.
 */
export function MobileNav({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { main, account } = NAVIGATION[user.role];

  const primary = main.filter((item) => item.primary);
  const overflow: NavItem[] = [...main.filter((item) => !item.primary), ...account];
  const moreActive = overflow.some((item) => isNavItemActive(pathname, item));

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl lg:hidden print:hidden"
      >
        <ul className="safe-bottom mx-auto flex max-w-xl items-stretch justify-around px-2 pt-1.5">
          {primary.map((item) => {
            const active = isNavItemActive(pathname, item);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex min-h-[52px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {active && (
                    <motion.span
                      layoutId="mobile-nav-active"
                      className="absolute inset-x-2 top-0 h-1 rounded-full bg-brand-gradient"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon
                    className={cn('h-5 w-5 transition-colors', active ? 'text-brand' : 'text-muted-foreground')}
                    aria-hidden
                  />
                  <span className={cn(active ? 'text-foreground' : 'text-muted-foreground')}>{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className="relative flex min-h-[52px] w-full min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {moreActive && <span className="absolute inset-x-2 top-0 h-1 rounded-full bg-brand-gradient" />}
              <Ellipsis
                className={cn('h-5 w-5', moreActive ? 'text-brand' : 'text-muted-foreground')}
                aria-hidden
              />
              <span className={cn(moreActive ? 'text-foreground' : 'text-muted-foreground')}>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="lg:hidden">
          <SheetHeader className="mb-4">
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Everything else in your {user.role} space.</SheetDescription>
          </SheetHeader>
          <ul className="grid grid-cols-3 gap-3 pb-2">
            {overflow.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center text-xs font-semibold transition-colors',
                      active
                        ? 'border-brand/40 bg-brand/10 text-brand'
                        : 'border-border bg-card hover:bg-accent',
                    )}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
