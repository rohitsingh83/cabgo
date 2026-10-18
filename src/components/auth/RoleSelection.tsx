'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSession, useUser } from '@/lib/auth/clerk-client';
import { ArrowRight, BadgeIndianRupee, CarFront, CheckCircle2, MapPin, Shield, Wallet } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { onboardingSchema, type OnboardingFormValues } from '@/lib/validations';
import { useUserStore } from '@/store/useUserStore';
import type { ApiResponse } from '@/types';

interface RoleSelectionProps {
  initialName: string;
  initialPhone: string;
  email: string | null;
}

const ROLE_OPTIONS = [
  {
    value: 'rider' as const,
    title: 'I need a ride',
    subtitle: 'Book cabs, autos and bikes in seconds',
    icon: MapPin,
    perks: [
      { icon: CheckCircle2, text: 'Upfront fares, no surprises' },
      { icon: Shield, text: 'Live tracking & SOS button' },
      { icon: Wallet, text: 'Promo codes & saved places' },
    ],
    accent: 'from-blue-500 to-indigo-600',
  },
  {
    value: 'driver' as const,
    title: 'I want to drive',
    subtitle: 'Earn on your own schedule',
    icon: CarFront,
    perks: [
      { icon: BadgeIndianRupee, text: 'Keep up to 80% of every fare' },
      { icon: CheckCircle2, text: 'Go online whenever you like' },
      { icon: Shield, text: 'Verified riders, 24×7 support' },
    ],
    accent: 'from-emerald-500 to-teal-600',
  },
];

/**
 * First-run onboarding: pick Rider or Driver, confirm your name, optionally add a phone number.
 * The role is permanent, so we make the choice explicit and visual.
 */
export function RoleSelection({ initialName, initialPhone, email }: RoleSelectionProps) {
  const { user } = useUser();
  const { session } = useSession();
  const setUser = useUserStore((state) => state.setUser);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { role: undefined, fullName: initialName, phone: initialPhone },
    mode: 'onTouched',
  });

  const selectedRole = form.watch('role');

  async function onSubmit(values: OnboardingFormValues) {
    setSubmitting(true);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const body = (await response.json()) as ApiResponse<{ role: string; redirectTo: string }>;

      if (!response.ok || !body.success) {
        if (!body.success && body.details) {
          // Surface server-side field errors inline.
          for (const [field, messages] of Object.entries(body.details)) {
            const message = messages?.[0];
            if (message && (field === 'fullName' || field === 'phone' || field === 'role')) {
              form.setError(field, { message });
            }
          }
        }
        throw new Error(body.success ? 'Could not finish setup' : body.error);
      }

      toast({ variant: 'success', title: 'You are all set 🎉', description: 'Taking you to your dashboard…' });

      // Refresh the Clerk user + session token so the middleware sees the new role immediately,
      // then hard-navigate so the fresh __session cookie is sent with the next request.
      await user?.reload();
      await session?.getToken({ skipCache: true });
      setUser(null); // force the store to reload the profile (new role) on the next page
      sessionStorage.removeItem('cabgo:finish-setup-attempts');
      window.location.assign(body.data.redirectTo);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
      setSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" noValidate>
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel className="sr-only">How will you use CabGo?</FormLabel>
              <FormControl>
                <div role="radiogroup" aria-label="How will you use CabGo?" className="grid gap-4 sm:grid-cols-2">
                  {ROLE_OPTIONS.map((option) => {
                    const selected = field.value === option.value;
                    const Icon = option.icon;
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => field.onChange(option.value)}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                        className={cn(
                          'group relative flex min-h-[44px] flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 text-left shadow-soft transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          selected ? 'border-brand ring-2 ring-brand/40' : 'border-border hover:border-foreground/30',
                        )}
                      >
                        {selected && (
                          <motion.span
                            layoutId="role-glow"
                            className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br opacity-[0.07]', option.accent)}
                          />
                        )}
                        <span
                          className={cn(
                            'flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-soft',
                            option.accent,
                          )}
                        >
                          <Icon className="h-6 w-6" aria-hidden />
                        </span>
                        <span>
                          <span className="block text-lg font-bold">{option.title}</span>
                          <span className="block text-sm text-muted-foreground">{option.subtitle}</span>
                        </span>
                        <ul className="space-y-2">
                          {option.perks.map(({ icon: PerkIcon, text }) => (
                            <li key={text} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <PerkIcon className="h-4 w-4 shrink-0 text-success" aria-hidden />
                              {text}
                            </li>
                          ))}
                        </ul>
                        <span
                          className={cn(
                            'absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                            selected ? 'border-brand bg-brand text-white' : 'border-muted-foreground/30',
                          )}
                          aria-hidden
                        >
                          {selected && <CheckCircle2 className="h-4 w-4" />}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input placeholder="Priya Sharma" autoComplete="name" {...field} />
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
                <FormLabel>
                  Phone <span className="font-normal text-muted-foreground">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Input type="tel" inputMode="tel" placeholder="+91 98765 43210" autoComplete="tel" {...field} value={field.value ?? ''} />
                </FormControl>
                <FormDescription>Used by your driver or rider to reach you.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {email && (
          <p className="text-xs text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{email}</span>
          </p>
        )}

        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full btn-glow"
          loading={submitting}
          disabled={!selectedRole}
        >
          {selectedRole === 'driver' ? 'Continue as driver' : selectedRole === 'rider' ? 'Continue as rider' : 'Choose a role to continue'}
          <ArrowRight />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Your role can’t be changed later, so choose carefully. Need both? Contact support.
        </p>
      </form>
    </Form>
  );
}
