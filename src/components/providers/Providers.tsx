'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';

import { UserSync } from '@/components/providers/UserSync';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

/**
 * Client-side providers mounted once in the root layout (inside <ClerkProvider>).
 *  - next-themes: class-based dark mode, follows the OS until the user picks a theme,
 *    persisted in localStorage under `cabgo-theme`
 *  - Tooltip provider + toast outlet
 *  - UserSync: hydrates the Zustand user store from the Clerk session
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="cabgo-theme"
    >
      <TooltipProvider delayDuration={150}>
        <UserSync />
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
