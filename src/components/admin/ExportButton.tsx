import { Download } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  type: 'rides' | 'payments' | 'users';
  range?: string;
  status?: string;
}

/** Plain download link to the CSV route — the browser streams the file, no client JavaScript involved. */
export function ExportButton({ type, range, status }: ExportButtonProps) {
  const params = new URLSearchParams({ type });
  if (range && range !== 'all') params.set('range', range);
  if (status && status !== 'all') params.set('status', status);
  return (
    <a href={`/api/admin/export?${params.toString()}`} download className={cn(buttonVariants({ variant: 'outline' }), 'h-12 w-full sm:w-auto')}>
      <Download aria-hidden /> Export CSV
    </a>
  );
}
