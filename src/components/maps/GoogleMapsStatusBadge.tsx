'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle2, Key, Settings } from 'lucide-react';

import { useGoogleMaps } from '@/hooks/use-google-maps';
import { GoogleMapsSetupDialog } from '@/components/maps/GoogleMapsSetupDialog';
import { cn } from '@/lib/utils';

interface GoogleMapsStatusBadgeProps {
  className?: string;
}

export function GoogleMapsStatusBadge({ className }: GoogleMapsStatusBadgeProps) {
  const { status } = useGoogleMaps();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div className={cn('pointer-events-auto flex items-center', className)}>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          title="Google Maps Configuration Status"
          className={cn(
            'group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-lift backdrop-blur-md transition-all hover:scale-105 active:scale-95',
            status === 'ready' &&
              'border border-emerald-500/30 bg-background/90 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
            status === 'unconfigured' &&
              'border border-amber-500/30 bg-background/90 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40',
            status === 'error' &&
              'border border-destructive/30 bg-background/90 text-destructive hover:bg-destructive/10',
            status === 'loading' &&
              'border border-primary/30 bg-background/90 text-primary',
          )}
        >
          {status === 'ready' && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Google Maps Active</span>
            </>
          )}

          {status === 'unconfigured' && (
            <>
              <Key className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Google Maps: Setup Key</span>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              <span>Google Maps Error</span>
            </>
          )}

          {status === 'loading' && (
            <>
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Connecting Maps...</span>
            </>
          )}

          <Settings className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
        </button>
      </div>

      <GoogleMapsSetupDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
