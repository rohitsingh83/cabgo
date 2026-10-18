import { ok, parseBody, parseQuery, requireApiUser, withApi } from '@/lib/api';
import { emitRealtime, room } from '@/lib/realtime';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { notificationsMarkReadSchema, notificationsQuerySchema } from '@/lib/validations';
import type { NotificationsPage } from '@/types';

export const dynamic = 'force-dynamic';

async function countUnread(userId: string): Promise<number> {
  const db = createSupabaseAdminClient();
  const { count, error } = await db
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw new Error(`Failed to count notifications: ${error.message}`);
  return count ?? 0;
}

/**
 * GET /api/notifications?limit=20&before=<ISO>&unreadOnly=true
 * Newest first, keyset-paginated by `created_at`. Always scoped to the signed-in user.
 */
export const GET = withApi(async (request) => {
  const user = await requireApiUser();
  const { limit, before, unreadOnly } = parseQuery(request, notificationsQuerySchema);

  const db = createSupabaseAdminClient();
  let query = db
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // one extra row tells us whether another page exists
  if (before) query = query.lt('created_at', before);
  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load notifications: ${error.message}`);

  const rows = data ?? [];
  const page: NotificationsPage = {
    items: rows.slice(0, limit),
    hasMore: rows.length > limit,
    unreadCount: await countUnread(user.id),
  };
  return ok(page);
}, 'GET /api/notifications');

/**
 * PATCH /api/notifications  { ids: uuid[] } | { all: true }
 * Marks notifications as read and tells the user's other open tabs/devices to do the same.
 */
export const PATCH = withApi(async (request) => {
  const user = await requireApiUser();
  const input = await parseBody(request, notificationsMarkReadSchema);

  const db = createSupabaseAdminClient();
  let update = db
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('user_id', user.id) // ownership: ids belonging to other users simply match nothing
    .eq('is_read', false);
  if ('ids' in input) update = update.in('id', input.ids);

  const { data, error } = await update.select('id');
  if (error) throw new Error(`Failed to mark notifications as read: ${error.message}`);

  const changed = (data ?? []).map((row) => row.id);
  if (changed.length > 0) {
    await emitRealtime({
      rooms: [room.user(user.id)],
      event: 'notification:read',
      payload: 'all' in input ? { ids: changed, all: true } : { ids: changed },
    });
  }

  return ok({ updated: changed.length, unreadCount: await countUnread(user.id) });
}, 'PATCH /api/notifications');
