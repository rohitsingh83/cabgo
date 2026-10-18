import { CheckCircle2, CircleDot, Hourglass } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { TICKET_STATUS_LABEL } from '@/lib/feedback';
import type { TicketStatus } from '@/types';

const CONFIG: Record<TicketStatus, { variant: 'warning' | 'info' | 'success'; icon: typeof CircleDot }> = {
  open: { variant: 'warning', icon: CircleDot },
  in_progress: { variant: 'info', icon: Hourglass },
  resolved: { variant: 'success', icon: CheckCircle2 },
};

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { variant, icon: Icon } = CONFIG[status];
  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" aria-hidden /> {TICKET_STATUS_LABEL[status]}
    </Badge>
  );
}
