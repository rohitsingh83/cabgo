'use client';

import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { TICKET_STATUS_LABEL } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { adminTicketUpdateSchema } from '@/lib/validations';
import type { TicketStatus } from '@/types';

type FormValues = z.input<typeof adminTicketUpdateSchema>;

const STATUSES: TicketStatus[] = ['open', 'in_progress', 'resolved'];
const MAX = 4000;

/** Reply to a ticket and set its status. Resolving requires a written reply (checked here and on the server). */
export function TicketReplyForm({ ticketId, status, existingResponse }: { ticketId: string; status: TicketStatus; existingResponse: string | null }) {
  const router = useRouter();
  const form = useForm<FormValues>({
    resolver: zodResolver(adminTicketUpdateSchema),
    defaultValues: { status, response: existingResponse ?? '' },
  });
  const response = form.watch('response') ?? '';

  const onSubmit = async (values: FormValues) => {
    const reply = (values.response ?? '').trim();
    if (values.status === 'resolved' && !reply) {
      form.setError('response', { message: 'Write a reply before resolving the ticket.' });
      return;
    }
    try {
      await apiFetch(`/api/admin/support/${ticketId}`, {
        method: 'PATCH',
        // Only send the reply when it actually changed, so re-saving a status does not re-notify the customer.
        body: { status: values.status, ...(reply && reply !== (existingResponse ?? '') ? { response: reply } : {}) },
      });
      toast({ variant: 'success', title: 'Ticket updated', description: 'The customer has been notified.' });
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        const message = error.details?.response?.[0];
        if (message) form.setError('response', { message });
        else toast({ variant: 'destructive', title: 'Could not update the ticket', description: error.message });
        return;
      }
      toast({ variant: 'destructive', title: 'Could not update the ticket', description: 'Please try again.' });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status</FormLabel>
              <div role="radiogroup" aria-label="Ticket status" className="grid grid-cols-3 gap-2">
                {STATUSES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={field.value === option}
                    onClick={() => field.onChange(option)}
                    className={cn(
                      'min-h-[48px] rounded-xl border px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      field.value === option ? 'border-brand bg-brand/10 text-brand' : 'border-border hover:border-brand/50',
                    )}
                  >
                    {TICKET_STATUS_LABEL[option]}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="response"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reply to the customer</FormLabel>
              <FormControl>
                <Textarea rows={6} maxLength={MAX} placeholder="Explain what you found and what happens next…" className="resize-y" {...field} value={field.value ?? ''} />
              </FormControl>
              <div className="flex items-start justify-between gap-2">
                <FormMessage />
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {response.length}/{MAX}
                </span>
              </div>
            </FormItem>
          )}
        />

        <Button type="submit" variant="brand" size="lg" className="h-12 w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} Save &amp; notify customer
        </Button>
      </form>
    </Form>
  );
}
