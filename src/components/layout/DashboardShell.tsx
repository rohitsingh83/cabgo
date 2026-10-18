import type { ReactNode } from 'react';

import { DashboardHeader } from '@/components/layout/DashboardHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';
import { RealtimeProvider } from '@/components/providers/RealtimeProvider';
import type { ShellUser } from '@/components/layout/types';

/**
 * Responsive dashboard frame (wrapped in the realtime provider: one socket per signed-in session).
 *  - ≥ lg : fixed dark sidebar + sticky header + content
 *  - < lg : sticky header + content + bottom tab bar (content gets bottom padding to clear it)
 */
export function DashboardShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  return (
    <RealtimeProvider>
      <div className="min-h-screen bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Sidebar user={user} />
        <div className="flex min-h-screen flex-col lg:pl-64 print:pl-0">
          <DashboardHeader user={user} />
          <main
            id="main-content"
            className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10 print:max-w-none print:p-0"
          >
            {children}
          </main>
        </div>
        <MobileNav user={user} />
      </div>
    </RealtimeProvider>
  );
}
