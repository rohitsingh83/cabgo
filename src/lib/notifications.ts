import 'server-only';

import { emitRealtime, room } from '@/lib/realtime';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { AppNotification, NotificationData, NotificationType } from '@/types';

export interface NewNotification {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
}

/**
 * Persist notifications for one or many users. Never throws — a failed notification must
 * not break the business operation (booking, cancelling …) that triggered it.
 * Every stored notification is also pushed live to the user's open tabs/devices (best effort).
 * Returns the inserted rows.
 */
export async function createNotifications(items: NewNotification[]): Promise<AppNotification[]> {
  if (items.length === 0) return [];

  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('notifications')
      .insert(
        items.map((item) => ({
          user_id: item.userId,
          type: item.type,
          title: item.title,
          message: item.message,
          data: item.data ?? {},
        })),
      )
      .select('*');

    if (error) {
      console.error('[notifications] insert failed:', error.message);
      return [];
    }

    const rows = data ?? [];
    await emitRealtime(rows.map((row) => ({ rooms: [room.user(row.user_id)], event: 'notification' as const, payload: row })));
    return rows;
  } catch (error) {
    console.error('[notifications] unexpected failure:', error);
    return [];
  }
}

export async function createNotification(item: NewNotification): Promise<AppNotification | null> {
  const [created] = await createNotifications([item]);
  return created ?? null;
}

/**
 * Notify every active admin (new support ticket, SOS …). Never throws.
 * Admin accounts are few, so a single query without pagination is fine.
 */
export async function notifyAdmins(item: Omit<NewNotification, 'userId'>): Promise<void> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from('users').select('id').eq('role', 'admin').eq('is_active', true).limit(100);
    if (error) {
      console.error('[notifications] could not load admins:', error.message);
      return;
    }
    await createNotifications((data ?? []).map((admin) => ({ ...item, userId: admin.id })));
  } catch (error) {
    console.error('[notifications] notifyAdmins failed:', error);
  }
}
