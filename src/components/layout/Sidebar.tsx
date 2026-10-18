'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

import { Logo } from '@/components/shared/Logo';
import { UserAvatar } from '@/components/shared/UserAvatar';
import type { ShellUser } from '@/components/layout/types';
import { roleLabel } from '@/lib/roles';
import { isNavItemActive, NAVIGATION, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        active ? 'text-white' : 'text-white/55 hover:bg-white/5 hover:text-white',
      )}
    >
      {active && (
        // Shared layoutId makes the highlight glide between items when navigating.
        <motion.span
          layoutId="sidebar-active"
          className="absolute inset-0 rounded-xl bg-white/10 ring-1 ring-white/10"
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        >
          <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-brand-gradient shadow-glow" />
        </motion.span>
      )}
      <Icon className={cn('relative h-[1.15rem] w-[1.15rem] shrink-0', active && 'text-brand-400')} aria-hidden />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

/** Desktop navigation rail (≥ lg). Always dark — it is the visual anchor of the dashboard. */
export function Sidebar({ user }: { user: ShellUser }) {
  const pathname = usePathname();
  const { main, account } = NAVIGATION[user.role];

  return (
    <aside
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col overflow-hidden border-r border-white/10 bg-brand-ink text-white lg:flex print:hidden"
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-brand-purple/20 blur-3xl"
        aria-hidden
      />

      <div className="relative flex h-16 shrink-0 items-center justify-between px-5">
        <Logo tone="light" size="sm" />
        <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white/70">
          {user.role}
        </span>
      </div>

      <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-4 no-scrollbar">
        <div>
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-white/35">Menu</p>
          <ul className="space-y-1">
            {main.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={isNavItemActive(pathname, item)} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-white/35">Account</p>
          <ul className="space-y-1">
            {account.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={isNavItemActive(pathname, item)} />
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="relative shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
          <UserAvatar name={user.name} src={user.avatarUrl} className="h-10 w-10 ring-white/10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-white/50">{roleLabel(user.role)}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
