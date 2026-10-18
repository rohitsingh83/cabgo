'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { TICKET_CATEGORIES } from '@/lib/feedback';
import { cn, formatDate } from '@/lib/utils';
import { createTicketSchema } from '@/lib/validations';
import type { SupportTicket } from '@/types';

export interface RideOption {
  id: string;
  label: string;
  created_at: string;
}

type FormValues = z.input<typeof createTicketSchema>;

const NO_RIDE = 'none';
const MAX_DESCRIPTION = 4000;

interface NewTicketDialogProps {
  rides: RideOption[];
  /** `/rider/support` or `/driver/support`; the new ticket opens at `${basePath}/${id}`. */
  basePath: string;
  /** Pre-selects a ride (deep link from a trip page). */
  defaultRideId?: string;
  triggerClassName?: string;
}

/** "New ticket" button + dialog with a validated form (category cards, subject, details, optional ride). */
export function NewTicketDialog({ rides, basePath, defaultRideId, triggerClassName }: NewTicketDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { category: 'other', subject: '', description: '', rideId: defaultRideId },
  });
  const description = form.watch('description') ?? '';

  const onSubmit = async (values: FormValues) => {
    try {
      const body = createTicketSchema.parse(values);
      const ticket = await apiFetch<SupportTicket>('/api/support', { method: 'POST', body });
      toast({ variant: 'success', title: 'Ticket sent', description: 'Our team will reply here. You can follow progress any time.' });
      setOpen(false);
      form.reset({ category: 'other', subject: '', description: '', rideId: undefined });
      router.push(`${basePath}/${ticket.id}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiClientError) {
        // Map server-side field errors back onto the form where we can.
        const fields = ['category', 'subject', 'description', 'rideId'] as const;
        let mapped = false;
        for (const field of fields) {
          const message = error.details?.[field]?.[0];
          if (message) {
            form.setError(field, { message });
            mapped = true;
          }
        }
        if (!mapped) toast({ variant: 'destructive', title: 'Could not send ticket', description: error.message });
        return;
      }
      toast({ variant: 'destructive', title: 'Could not send ticket', description: 'Please check the form and try again.' });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (form.formState.isSubmitting) return;
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="brand" size="lg" className={cn('h-12', triggerClassName)}>
          <Plus aria-hidden /> New ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">How can we help?</DialogTitle>
          <DialogDescription>Tell us what happened and we&apos;ll get back to you here.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What is this about?</FormLabel>
                  <div role="radiogroup" aria-label="Category" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TICKET_CATEGORIES.map((category) => {
                      const selected = field.value === category.value;
                      return (
                        <button
                          key={category.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => field.onChange(category.value)}
                          className={cn(
                            'min-h-[56px] rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            selected ? 'border-brand bg-brand/10' : 'border-border hover:border-brand/50',
                          )}
                        >
                          <span className="block text-sm font-semibold">{category.label}</span>
                          <span className="block text-xs text-muted-foreground">{category.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="A short summary" maxLength={200} className="h-12" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details</FormLabel>
                  <FormControl>
                    <Textarea rows={5} maxLength={MAX_DESCRIPTION} placeholder="What happened? Include times, amounts or anything that helps us investigate." className="resize-none" {...field} />
                  </FormControl>
                  <div className="flex items-start justify-between gap-2">
                    <FormMessage />
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {description.length}/{MAX_DESCRIPTION}
                    </span>
                  </div>
                </FormItem>
              )}
            />

            {rides.length > 0 && (
              <FormField
                control={form.control}
                name="rideId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Related ride (optional)</FormLabel>
                    <Select value={field.value ?? NO_RIDE} onValueChange={(value) => field.onChange(value === NO_RIDE ? undefined : value)}>
                      <FormControl>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Not about a specific ride" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-w-[calc(100vw-2rem)]">
                        <SelectItem value={NO_RIDE}>Not about a specific ride</SelectItem>
                        {rides.map((ride) => (
                          <SelectItem key={ride.id} value={ride.id}>
                            <span className="block max-w-[320px] truncate">
                              {formatDate(ride.created_at)} · {ride.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)} disabled={form.formState.isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="brand" className="h-11" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Send ticket
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
