'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Phone, Plus, Trash2, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { emergencyContactSchema } from '@/lib/validations';
import type { EmergencyContact } from '@/types';

const MAX_CONTACTS = 5;
const RELATIONSHIPS = ['Family', 'Friend', 'Partner', 'Colleague'] as const;

type FormValues = z.input<typeof emergencyContactSchema>;

/** Up to five people who get a text with the live location when the user raises an SOS. */
export function EmergencyContactsManager({ initialContacts }: { initialContacts: EmergencyContact[] }) {
  const [contacts, setContacts] = useState(initialContacts);
  const [adding, setAdding] = useState(false);
  const [toDelete, setToDelete] = useState<EmergencyContact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: { name: '', phone: '', relationship: 'Family' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const parsed = emergencyContactSchema.parse(values);
      const saved = await apiFetch<EmergencyContact>('/api/emergency-contacts', { method: 'POST', body: parsed });
      setContacts((prev) => [...prev, saved]);
      toast({ variant: 'success', title: 'Contact added', description: `${saved.name} will be notified if you send an SOS.` });
      form.reset({ name: '', phone: '', relationship: 'Family' });
      setAdding(false);
    } catch (error) {
      if (error instanceof ApiClientError) {
        const phoneError = error.details?.phone?.[0];
        if (phoneError || error.status === 409) {
          form.setError('phone', { message: phoneError ?? error.message });
          return;
        }
        toast({ variant: 'destructive', title: 'Could not add contact', description: error.message });
        return;
      }
      toast({ variant: 'destructive', title: 'Could not add contact', description: 'Please check the details and try again.' });
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch<{ id: string }>(`/api/emergency-contacts/${toDelete.id}`, { method: 'DELETE' });
      setContacts((prev) => prev.filter((contact) => contact.id !== toDelete.id));
      toast({ title: 'Contact removed' });
      setToDelete(null);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not remove contact', description: error instanceof ApiClientError ? error.message : 'Please try again.' });
    } finally {
      setDeleting(false);
    }
  };

  const full = contacts.length >= MAX_CONTACTS;

  return (
    <div className="space-y-3">
      {contacts.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
          No emergency contacts yet. Add someone you trust — they&apos;ll get a text with your live location if you press SOS.
        </p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {contacts.map((contact) => (
              <motion.li
                key={contact.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <UserRound className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{contact.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {contact.relationship} · {contact.phone}
                  </p>
                </div>
                <a href={`tel:${contact.phone}`} aria-label={`Call ${contact.name}`} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Phone className="h-4 w-4" aria-hidden />
                </a>
                <Button variant="ghost" size="icon" aria-label={`Remove ${contact.name}`} onClick={() => setToDelete(contact)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <Button variant="outline" className="h-12 w-full" onClick={() => setAdding(true)} disabled={full}>
        <Plus aria-hidden /> {full ? `Limit of ${MAX_CONTACTS} reached` : 'Add emergency contact'}
      </Button>

      <Dialog
        open={adding}
        onOpenChange={(open) => {
          if (form.formState.isSubmitting) return;
          setAdding(open);
          if (!open) form.reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add emergency contact</DialogTitle>
            <DialogDescription>Include the country code for numbers outside India, e.g. +14155550123.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" placeholder="Asha Rao" className="h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone number</FormLabel>
                    <FormControl>
                      <Input type="tel" inputMode="tel" autoComplete="off" placeholder="+91 98765 43210" className="h-12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Relationship">
                      {RELATIONSHIPS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={field.value === option}
                          onClick={() => field.onChange(option)}
                          className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            field.value === option ? 'border-brand bg-brand text-white' : 'border-border hover:border-brand/60'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-2">
                <Button type="button" variant="ghost" className="h-11" onClick={() => setAdding(false)} disabled={form.formState.isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="brand" className="h-11" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />} Save contact
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {toDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>They will no longer be texted if you press SOS.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel disabled={deleting} className="mt-0 h-11">
              Keep
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting && <Loader2 className="animate-spin" aria-hidden />} Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
