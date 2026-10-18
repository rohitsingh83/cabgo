import { UserAvatar } from '@/components/shared/UserAvatar';
import type { UserBrief } from '@/lib/admin/common';

/** Avatar + name + secondary line (email or phone) used in every admin table. */
export function PersonCell({ user, fallback = '—', showContact = true }: { user: UserBrief | null; fallback?: string; showContact?: boolean }) {
  if (!user) return <span className="text-muted-foreground">{fallback}</span>;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <UserAvatar name={user.full_name} src={user.avatar_url} className="h-9 w-9 shrink-0 text-xs" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{user.full_name}</span>
        {showContact && <span className="block truncate text-xs font-normal text-muted-foreground">{user.email ?? user.phone ?? '—'}</span>}
      </span>
    </span>
  );
}
