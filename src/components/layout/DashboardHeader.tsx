'use client';

import { usePathname } from 'next/navigation';

import type { ShellUser } from '@/components/layout/types';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { UserMenu } from '@/components/layout/UserMenu';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { getPageTitle } from '@/lib/navigation';

/** Sticky top bar: logo (mobile) · page title · theme + account controls. */
export function DashboardHeader({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const title = getPageTitle(pathname, user.role);

  return (
    <header className="print:hidden sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="lg:hidden">
            <Logo iconOnly size="sm" />
          </div>
          <h2 className="truncate font-display text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
