'use client';

import { useRouter } from 'next/navigation';

import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/components/ui/use-toast';
import { useSocketEvent } from '@/hooks/use-realtime';

/**
 * Mounted once in the admin layout. A new SOS alert is announced immediately with a link to the alert
 * list, and server-rendered data on the current page is refreshed so counts and banners stay current.
 * (Renders nothing.)
 */
export function AdminLiveListener() {
  const router = useRouter();

  useSocketEvent('sos:alert', () => {
    toast({
      variant: 'destructive',
      title: '🚨 New SOS alert',
      description: 'A rider or driver needs help. Open the alert to see their location.',
      action: (
        <ToastAction altText="Open SOS alerts" onClick={() => router.push('/admin/sos')}>
          Open
        </ToastAction>
      ),
    });
    router.refresh();
  });

  return null;
}
