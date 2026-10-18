import {
  Banknote,
  CarFront,
  CircleUser,
  CreditCard,
  History,
  House,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  Route,
  Settings,
  ShieldAlert,
  Star,
  Tag,
  Users,
  Wallet,
  BadgeCheck,
} from 'lucide-react';

import type { UserRole } from '@/types';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Only highlight on an exact pathname match (dashboard home pages). */
  exact?: boolean;
  /** Extra path prefixes that should also light this item up (e.g. live tracking → Book). */
  alsoMatches?: readonly string[];
  /** Show in the mobile bottom bar (the rest go into the "More" sheet). */
  primary?: boolean;
}

export interface RoleNavigation {
  main: readonly NavItem[];
  account: readonly NavItem[];
}

/**
 * Single source of truth for dashboard navigation — consumed by the desktop sidebar, the
 * mobile bottom bar, the "More" sheet, the user menu and the page-title lookup.
 */
export const NAVIGATION: Record<UserRole, RoleNavigation> = {
  rider: {
    main: [
      { label: 'Home', href: '/rider', icon: House, exact: true, primary: true },
      {
        label: 'Book',
        href: '/rider/book',
        icon: CarFront,
        alsoMatches: ['/rider/tracking'],
        primary: true,
      },
      { label: 'Trips', href: '/rider/history', icon: History, primary: true },
      { label: 'Payments', href: '/rider/payments', icon: CreditCard, primary: true },
      { label: 'Support', href: '/rider/support', icon: LifeBuoy },
    ],
    account: [
      { label: 'Profile', href: '/rider/profile', icon: CircleUser },
      { label: 'Settings', href: '/rider/settings', icon: Settings },
    ],
  },
  driver: {
    main: [
      { label: 'Dashboard', href: '/driver', icon: LayoutDashboard, exact: true, primary: true },
      { label: 'Rides', href: '/driver/rides', icon: Route, primary: true },
      { label: 'Earnings', href: '/driver/earnings', icon: Wallet, primary: true },
      { label: 'Ratings', href: '/driver/ratings', icon: Star, primary: true },
      { label: 'Support', href: '/driver/support', icon: LifeBuoy },
    ],
    account: [
      { label: 'Profile', href: '/driver/profile', icon: CircleUser },
      { label: 'Settings', href: '/driver/settings', icon: Settings },
    ],
  },
  admin: {
    main: [
      { label: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true, primary: true },
      { label: 'Users', href: '/admin/users', icon: Users, primary: true },
      { label: 'Drivers', href: '/admin/drivers', icon: BadgeCheck },
      { label: 'Rides', href: '/admin/rides', icon: Route, primary: true },
      { label: 'Payments', href: '/admin/payments', icon: Banknote, primary: true },
      { label: 'Promo codes', href: '/admin/promo', icon: Tag },
      { label: 'Support', href: '/admin/support', icon: LifeBuoy },
      { label: 'SOS alerts', href: '/admin/sos', icon: ShieldAlert },
    ],
    account: [{ label: 'Settings', href: '/admin/settings', icon: Settings }],
  },
};

/** Does `pathname` belong to nav item `item`? */
export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  if (item.exact) return false;
  const prefixes = [item.href, ...(item.alsoMatches ?? [])];
  return prefixes.some((prefix) => pathname.startsWith(`${prefix}/`) || pathname === prefix);
}

/** Heading shown in the dashboard header for the current route. */
export function getPageTitle(pathname: string, role: UserRole): string {
  const { main, account } = NAVIGATION[role];
  const match = [...main, ...account].find((item) => isNavItemActive(pathname, item));
  if (pathname.startsWith('/rider/tracking')) return 'Live ride';
  if (pathname === '/rider/book') return 'Book a ride';
  if (pathname === '/rider/history') return 'Your trips';
  return match?.label ?? 'Dashboard';
}
