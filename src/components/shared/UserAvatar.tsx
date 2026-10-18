import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, getInitials } from '@/lib/utils';

interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  className?: string;
}

/** Avatar with a gradient initials fallback. */
export function UserAvatar({ name, src, className }: UserAvatarProps) {
  return (
    <Avatar className={cn('ring-2 ring-background', className)}>
      {src ? <AvatarImage src={src} alt={name ?? 'User avatar'} /> : null}
      <AvatarFallback>{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
