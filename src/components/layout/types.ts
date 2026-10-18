import type { UserRole } from '@/types';

/** Minimal, serialisable user snapshot passed from server layouts to client shell components. */
export interface ShellUser {
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: UserRole;
}
