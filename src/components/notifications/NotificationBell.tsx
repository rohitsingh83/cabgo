'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellOff, CheckCheck, Loader2, RefreshCw } from 'lucide-react';

import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/hooks/use-notifications';
import { useRealtime } from '@/hooks/use-realtime';
import type { AppNotification } from '@/types';

/** Header bell: unread badge + inbox popover. Also the single mount point of the notification listeners. */
export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { status: socketStatus } = useRealtime();
  const { items, unreadCount, hasMore, status, loadingMore, reload, loadMore, markRead, markAllRead } = useNotifications();

  const badge = unreadCount > 9 ? '9+' : String(unreadCount);

  const select = (notification: AppNotification) => {
    void markRead([notification.id]);
    const url = typeof notification.data.url === 'string' ? notification.data.url : null;
    if (url?.startsWith('/')) {
      setOpen(false);
      router.push(url);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-11 w-11"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        >
          <Bell className="h-5 w-5" aria-hidden />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white ring-2 ring-background"
              >
                {badge}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={10} className="w-[min(94vw,24rem)] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-extrabold">Notifications</h2>
            <span
              className={`h-2 w-2 rounded-full ${socketStatus === 'connected' ? 'bg-success' : 'bg-muted-foreground/40'}`}
              title={socketStatus === 'connected' ? 'Live updates on' : 'Live updates paused — refreshing periodically'}
              aria-hidden
            />
          </div>
          <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs" disabled={unreadCount === 0} onClick={() => void markAllRead()}>
            <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
          </Button>
        </div>

        <div className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain">
          {status === 'loading' || status === 'idle' ? (
            <ul aria-busy aria-label="Loading notifications" className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, index) => (
                <li key={index} className="flex gap-3 px-4 py-3">
                  <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </li>
              ))}
            </ul>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <p className="font-semibold">Couldn&apos;t load notifications</p>
              <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void reload()}>
                <RefreshCw aria-hidden /> Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <BellOff className="h-6 w-6" aria-hidden />
              </span>
              <p className="font-display text-base font-bold">You&apos;re all caught up</p>
              <p className="mt-1 text-sm text-muted-foreground">Ride updates and offers will show up here.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border">
                <AnimatePresence initial={false}>
                  {items.map((notification) => (
                    <motion.li
                      key={notification.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.2 }}
                    >
                      <NotificationItem notification={notification} onSelect={select} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              {hasMore && (
                <div className="border-t border-border p-2">
                  <Button variant="ghost" className="h-11 w-full text-sm" disabled={loadingMore} onClick={() => void loadMore()}>
                    {loadingMore ? <Loader2 className="animate-spin" aria-hidden /> : null} Load older
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
