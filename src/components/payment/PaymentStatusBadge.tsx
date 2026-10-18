import { CheckCircle2, Clock, RotateCcw, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { PaymentStatus } from '@/types';

const CONFIG = {
  completed: { label: 'Paid', variant: 'success', icon: CheckCircle2 },
  pending: { label: 'Payment due', variant: 'warning', icon: Clock },
  failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
  refunded: { label: 'Refunded', variant: 'info', icon: RotateCcw },
} as const;

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { label, variant, icon: Icon } = CONFIG[status];
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
