'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useClerk } from '@/lib/auth/clerk-client';
import { ChevronDown, LogOut } from 'lucide-react';

import type { ShellUser } from '@/components/layout/types';
import { UserAvatar } from '@/components/shared/UserAvatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NAVIGATION } from '@/lib/navigation';
import { roleLabel } from '@/lib/roles';

/** Avatar dropdown in the dashboard header: account links + sign out. */
export function UserMenu({ user }: { user: ShellUser }) {
  const { signOut } = useClerk();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: '/' });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Open account menu"
          className="group flex min-h-[44px] items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <UserAvatar name={user.name} src={user.avatarUrl} className="h-9 w-9" />
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5 font-normal">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          <p className="pt-1 text-[10px] font-bold uppercase tracking-widest text-brand">{roleLabel(user.role)}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {NAVIGATION[user.role].account.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild className="min-h-[44px] cursor-pointer">
            <Link href={href}>
              <Icon /> {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
          className="min-h-[44px] cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut /> {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
