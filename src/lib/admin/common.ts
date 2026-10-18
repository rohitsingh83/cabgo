import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Paginated, User } from '@/types';

export const ADMIN_PAGE_SIZE = 15;

/** The slice of a user shown next to rides, tickets, payments … in admin tables. */
export type UserBrief = Pick<User, 'id' | 'full_name' | 'email' | 'phone' | 'avatar_url' | 'role' | 'is_active'>;

export const USER_BRIEF_COLUMNS = 'id, full_name, email, phone, avatar_url, role, is_active';

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;

/** ISO timestamp for "now minus the range", or null for "all time". */
export function rangeStart(range: '7d' | '30d' | '90d' | 'all'): string | null {
  if (range === 'all') return null;
  return new Date(Date.now() - RANGE_DAYS[range] * 86_400_000).toISOString();
}

/** Inclusive row window for Supabase `.range()` on a 1-based page. */
export function pageWindow(page: number): { from: number; to: number } {
  const from = (page - 1) * ADMIN_PAGE_SIZE;
  return { from, to: from + ADMIN_PAGE_SIZE - 1 };
}

export function toPage<T>(items: T[], page: number, total: number | null): Paginated<T> {
  const count = total ?? items.length;
  return { items, page, pageSize: ADMIN_PAGE_SIZE, total: count, totalPages: Math.max(1, Math.ceil(count / ADMIN_PAGE_SIZE)) };
}

/** One query for all the people referenced by a page of rows (avoids N+1 lookups). */
export async function loadUserBriefs(ids: (string | null | undefined)[]): Promise<Map<string, UserBrief>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const db = createSupabaseAdminClient();
  const { data, error } = await db.from('users').select(USER_BRIEF_COLUMNS).in('id', unique);
  if (error) throw new Error(`Failed to load users: ${error.message}`);
  return new Map((data ?? []).map((user) => [user.id, user]));
}
