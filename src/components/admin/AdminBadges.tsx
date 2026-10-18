import { BadgeCheck, CheckCircle2, CircleSlash, Clock, Hourglass, ShieldAlert, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { PromoState } from '@/lib/admin/promo-state';
import type { SosStatus, UserRole, VerificationStatus } from '@/types';

export function UserStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="success" className="gap-1">
      <CheckCircle2 className="h-3 w-3" aria-hidden /> Active
    </Badge>
  ) : (
    <Badge variant="destructive" className="gap-1">
      <CircleSlash className="h-3 w-3" aria-hidden /> Suspended
    </Badge>
  );
}

const ROLE_STYLE: Record<UserRole, string> = {
  rider: 'bg-brand/10 text-brand',
  driver: 'bg-success/10 text-success',
  admin: 'bg-foreground text-background',
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_STYLE[role]}`}>{role}</span>;
}

const VERIFICATION = {
  pending: { label: 'Pending review', variant: 'warning', icon: Hourglass },
  approved: { label: 'Verified', variant: 'success', icon: BadgeCheck },
  rejected: { label: 'Rejected', variant: 'destructive', icon: XCircle },
} as const;

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { label, variant, icon: Icon } = VERIFICATION[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" aria-hidden /> {label}
    </Badge>
  );
}

const PROMO = {
  active: { label: 'Live', variant: 'success' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  expired: { label: 'Expired', variant: 'secondary' },
  exhausted: { label: 'Fully redeemed', variant: 'secondary' },
  inactive: { label: 'Paused', variant: 'warning' },
} as const;

export function PromoStateBadge({ state }: { state: PromoState }) {
  const { label, variant } = PROMO[state];
  return (
    <Badge variant={variant}>
      {state === 'scheduled' && <Clock className="h-3 w-3" aria-hidden />} {label}
    </Badge>
  );
}

export function SosStatusBadge({ status }: { status: SosStatus }) {
  return status === 'active' ? (
    <Badge variant="destructive" className="gap-1">
      <ShieldAlert className="h-3 w-3" aria-hidden /> Active
    </Badge>
  ) : (
    <Badge variant="success" className="gap-1">
      <CheckCircle2 className="h-3 w-3" aria-hidden /> Resolved
    </Badge>
  );
}
