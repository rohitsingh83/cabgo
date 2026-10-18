'use client';

import {
  AlertTriangle,
  BadgeCheck,
  Bell,
  Car,
  CheckCircle2,
  CircleDollarSign,
  LifeBuoy,
  MapPinCheck,
  Megaphone,
  Navigation,
  ShieldX,
  Star,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { cn, timeAgo } from '@/lib/utils';
import type { AppNotification, NotificationType } from '@/types';

/** Icon + colour per notification type. */
const STYLES: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  ride_requested: { icon: Car, tone: 'bg-brand/10 text-brand' },
  ride_accepted: { icon: CheckCircle2, tone: 'bg-success/10 text-success' },
  driver_arriving: { icon: MapPinCheck, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  ride_started: { icon: Navigation, tone: 'bg-brand/10 text-brand' },
  ride_completed: { icon: CheckCircle2, tone: 'bg-success/10 text-success' },
  ride_cancelled: { icon: XCircle, tone: 'bg-destructive/10 text-destructive' },
  payment_received: { icon: CircleDollarSign, tone: 'bg-success/10 text-success' },
  payment_failed: { icon: CircleDollarSign, tone: 'bg-destructive/10 text-destructive' },
  promo: { icon: Megaphone, tone: 'bg-purple-500/10 text-purple-500' },
  rating_received: { icon: Star, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  driver_verified: { icon: BadgeCheck, tone: 'bg-success/10 text-success' },
  driver_rejected: { icon: ShieldX, tone: 'bg-destructive/10 text-destructive' },
  ticket_update: { icon: LifeBuoy, tone: 'bg-brand/10 text-brand' },
  sos: { icon: AlertTriangle, tone: 'bg-destructive/10 text-destructive' },
  system: { icon: Bell, tone: 'bg-muted text-muted-foreground' },
};

interface NotificationItemProps {
  notification: AppNotification;
  onSelect: (notification: AppNotification) => void;
}

/** One row of the inbox. The whole row is a 44px+ tap target. */
export function NotificationItem({ notification, onSelect }: NotificationItemProps) {
  const { icon: Icon, tone } = STYLES[notification.type] ?? STYLES.system;

  return (
    <button
      type="button"
      onClick={() => onSelect(notification)}
      className={cn(
        'flex min-h-[64px] w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none',
        !notification.is_read && 'bg-brand/[0.04]',
      )}
    >
      <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn('text-sm leading-snug', notification.is_read ? 'font-medium' : 'font-bold')}>{notification.title}</span>
          {!notification.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
        </span>
        <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{notification.message}</span>
        <span className="mt-1 block text-xs text-muted-foreground/80">{timeAgo(notification.created_at)}</span>
      </span>
    </button>
  );
}
