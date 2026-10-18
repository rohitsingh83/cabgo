'use client';

import '@fontsource-variable/plus-jakarta-sans';
import './globals.css';

import { ErrorState } from '@/components/shared/ErrorState';

/**
 * Last-resort boundary: replaces the root layout, so it must render its own <html>/<body>.
 * Providers (Clerk, theme) are unavailable here — the stored theme is applied by a tiny
 * inline script instead.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const applyTheme = `try{var t=localStorage.getItem('cabgo-theme');var d=t==='dark'||((!t||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyTheme }} />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ErrorState
          fullScreen
          title="CabGo hit a roadblock"
          message="A critical error stopped the app from loading. Reloading usually fixes it."
          digest={error.digest}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
