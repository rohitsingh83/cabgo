'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';

import { PromoStateBadge } from '@/components/admin/AdminBadges';
import { EmptyState } from '@/components/shared/EmptyState';
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
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { promoState } from '@/lib/admin/promo-state';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { createPromoSchema, updatePromoSchema } from '@/lib/validations';
import type { PromoCode } from '@/types';

interface PromoFormValues {
  code: string;
  description: string;
  discountType: 'percentage' | 'flat';
  discountValue: string;
  maxDiscount: string;
  minFare: string;
  maxUses: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
}

/** ISO timestamp → value for `<input type="datetime-local">` in the viewer's timezone. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const inDays = (days: number) => toLocalInput(new Date(Date.now() + days * 86_400_000).toISOString());

function emptyForm(): PromoFormValues {
  return { code: '', description: '', discountType: 'percentage', discountValue: '', maxDiscount: '', minFare: '0', maxUses: '', validFrom: toLocalInput(new Date().toISOString()), validUntil: inDays(30), isActive: true };
}

function formFromPromo(promo: PromoCode): PromoFormValues {
  return {
    code: promo.code,
    description: promo.description ?? '',
    discountType: promo.discount_type,
    discountValue: String(Number(promo.discount_value)),
    maxDiscount: promo.max_discount === null ? '' : String(Number(promo.max_discount)),
    minFare: String(Number(promo.min_fare)),
    maxUses: promo.max_uses === null ? '' : String(promo.max_uses),
    validFrom: toLocalInput(promo.valid_from),
    validUntil: toLocalInput(promo.valid_until),
    isActive: promo.is_active,
  };
}

const num = (text: string): number | undefined => (text.trim() === '' || Number.isNaN(Number(text)) ? undefined : Number(text));
const iso = (local: string): string | undefined => (local && !Number.isNaN(new Date(local).getTime()) ? new Date(local).toISOString() : undefined);

/** Form strings → the API payload (blank optional numbers become null / unlimited). */
function toPayload(values: PromoFormValues) {
  return {
    code: values.code,
    description: values.description,
    discountType: values.discountType,
    discountValue: num(values.discountValue),
    maxDiscount: values.discountType === 'percentage' ? num(values.maxDiscount) ?? null : null,
    minFare: num(values.minFare) ?? 0,
    maxUses: num(values.maxUses) ?? null,
    validFrom: iso(values.validFrom),
    validUntil: iso(values.validUntil),
    isActive: values.isActive,
  };
}

/** Validates the form with the SAME Zod schemas the API uses, so the two can never disagree. */
function promoResolver(editing: boolean): Resolver<PromoFormValues> {
  return async (values) => {
    const errors: FieldErrors<PromoFormValues> = {};
    const required: [keyof PromoFormValues, string][] = [
      ['code', 'Enter a code'],
      ['discountValue', 'Enter a discount'],
      ['validFrom', 'Pick a start'],
      ['validUntil', 'Pick an end'],
    ];
    for (const [key, message] of required) {
      if (typeof values[key] === 'string' && !(values[key] as string).trim()) errors[key] = { type: 'required', message };
    }
    const result = (editing ? updatePromoSchema : createPromoSchema).safeParse(toPayload(values));
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof PromoFormValues | undefined;
        if (key && !errors[key]) errors[key] = { type: 'validation', message: issue.message };
      }
    }
    return Object.keys(errors).length > 0 ? { values: {}, errors } : { values, errors: {} };
  };
}

function discountLabel(promo: PromoCode): string {
  const value = Number(promo.discount_value);
  if (promo.discount_type === 'flat') return `${formatCurrency(value)} off`;
  return `${value}% off${promo.max_discount !== null ? ` · up to ${formatCurrency(Number(promo.max_discount))}` : ''}`;
}

export function PromoManager({ promos }: { promos: PromoCode[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<PromoCode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const toggle = async (promo: PromoCode, isActive: boolean) => {
    setToggling(promo.id);
    try {
      await apiFetch(`/api/admin/promo/${promo.id}`, { method: 'PATCH', body: { isActive } });
      toast({ variant: 'success', title: isActive ? `${promo.code} is live again` : `${promo.code} paused` });
      router.refresh();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not update the code', description: error instanceof ApiClientError ? error.message : 'Please try again.' });
    } finally {
      setToggling(null);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/admin/promo/${toDelete.id}`, { method: 'DELETE' });
      toast({ title: `${toDelete.code} deleted` });
      setToDelete(null);
      router.refresh();
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not delete the code', description: error instanceof ApiClientError ? error.message : 'Please try again.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="brand" size="lg" className="h-12 w-full sm:w-auto" onClick={() => setCreating(true)}>
          <Plus aria-hidden /> New promo code
        </Button>
      </div>

      {promos.length === 0 ? (
        <EmptyState icon={Tag} title="No promo codes here" description="Create a code to reward riders — percentage or flat discounts, with caps, minimum fares and limits." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {promos.map((promo) => {
            const state = promoState(promo);
            const used = promo.max_uses ? Math.min(100, Math.round((promo.current_uses / promo.max_uses) * 100)) : null;
            return (
              <li key={promo.id} className="flex flex-col rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-lg font-extrabold tracking-wider">{promo.code}</p>
                    <p className="font-display text-sm font-bold text-success">{discountLabel(promo)}</p>
                  </div>
                  <PromoStateBadge state={state} />
                </div>
                {promo.description && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{promo.description}</p>}

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Min fare</dt>
                    <dd className="font-semibold tabular-nums">{Number(promo.min_fare) > 0 ? formatCurrency(Number(promo.min_fare)) : 'None'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Valid</dt>
                    <dd className="font-semibold">
                      {formatDate(promo.valid_from)} – {formatDate(promo.valid_until)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Redeemed</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {promo.current_uses}
                      {promo.max_uses ? ` / ${promo.max_uses}` : ' · unlimited'}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Redemptions" aria-valuenow={used ?? 0} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-gradient-to-r from-brand to-success" style={{ width: `${used ?? (promo.current_uses > 0 ? 8 : 0)}%` }} />
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
                  <label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-3 text-sm font-medium">
                    <Switch checked={promo.is_active} onCheckedChange={(checked) => void toggle(promo, checked)} disabled={toggling === promo.id} aria-label={`${promo.code} active`} />
                    {promo.is_active ? 'Active' : 'Paused'}
                  </label>
                  <Button variant="outline" size="icon" aria-label={`Edit ${promo.code}`} onClick={() => setEditing(promo)}>
                    <Pencil />
                  </Button>
                  <Button variant="outline" size="icon" aria-label={`Delete ${promo.code}`} disabled={promo.current_uses > 0} title={promo.current_uses > 0 ? 'Redeemed codes are kept for the audit trail — pause it instead' : undefined} onClick={() => setToDelete(promo)}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <PromoFormDialog
        // Remount per target so the form always starts from the right values.
        key={editing?.id ?? (creating ? 'new' : 'closed')}
        open={creating || editing !== null}
        promo={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => router.refresh()}
      />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {toDelete?.code}?</AlertDialogTitle>
            <AlertDialogDescription>This code was never redeemed, so it is safe to remove. Riders who try it will see &ldquo;Invalid promo code&rdquo;.</AlertDialogDescription>
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
                void remove();
              }}
            >
              {deleting && <Loader2 className="animate-spin" aria-hidden />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: React.ReactNode; htmlFor: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function PromoFormDialog({ open, promo, onClose, onSaved }: { open: boolean; promo: PromoCode | null; onClose: () => void; onSaved: () => void }) {
  const editing = promo !== null;
  const form = useForm<PromoFormValues>({
    resolver: promoResolver(editing),
    defaultValues: promo ? formFromPromo(promo) : emptyForm(),
  });
  const { register, handleSubmit, watch, setValue, setError, formState } = form;
  const { errors, isSubmitting } = formState;
  const type = watch('discountType');
  const active = watch('isActive');
  const locked = editing && (promo?.current_uses ?? 0) > 0;

  const submit = async (values: PromoFormValues) => {
    const payload = toPayload(values);
    try {
      if (promo) await apiFetch(`/api/admin/promo/${promo.id}`, { method: 'PATCH', body: payload });
      else await apiFetch('/api/admin/promo', { method: 'POST', body: payload });
      toast({ variant: 'success', title: editing ? 'Promo code updated' : 'Promo code created', description: payload.code.toUpperCase() });
      onSaved();
      onClose();
    } catch (error) {
      if (error instanceof ApiClientError) {
        let mapped = false;
        for (const key of Object.keys(values) as (keyof PromoFormValues)[]) {
          const message = error.details?.[key]?.[0];
          if (message) {
            setError(key, { message });
            mapped = true;
          }
        }
        if (!mapped) toast({ variant: 'destructive', title: 'Could not save the code', description: error.message });
        return;
      }
      toast({ variant: 'destructive', title: 'Could not save the code', description: 'Please try again.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isSubmitting && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-8 font-display text-xl font-extrabold">{editing ? `Edit ${promo?.code}` : 'New promo code'}</DialogTitle>
          <DialogDescription>Riders enter the code at booking; the discount is checked again on the server.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <Field label="Code" htmlFor="promo-code" error={errors.code?.message} hint={locked ? 'Locked — this code has been redeemed.' : 'Letters, numbers, - and _. Stored in capitals.'}>
            <Input id="promo-code" className="h-12 font-mono uppercase tracking-wider" placeholder="WELCOME50" autoComplete="off" disabled={locked} {...register('code')} />
          </Field>

          <Field label="Description" htmlFor="promo-desc" error={errors.description?.message} hint="Shown to riders next to the code (optional).">
            <Input id="promo-desc" className="h-12" maxLength={200} placeholder="₹50 off your first ride" {...register('description')} />
          </Field>

          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Discount type</p>
            <div role="radiogroup" aria-label="Discount type" className="grid grid-cols-2 gap-2">
              {(['percentage', 'flat'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={type === option}
                  onClick={() => setValue('discountType', option, { shouldValidate: formState.isSubmitted })}
                  className={cn('min-h-[48px] rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', type === option ? 'border-brand bg-brand/10 text-brand' : 'border-border hover:border-brand/50')}
                >
                  {option === 'percentage' ? 'Percentage (%)' : 'Flat amount (₹)'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={type === 'percentage' ? 'Discount (%)' : 'Discount (₹)'} htmlFor="promo-value" error={errors.discountValue?.message}>
              <Input id="promo-value" type="number" inputMode="decimal" step="any" min="0" className="h-12" placeholder={type === 'percentage' ? '20' : '50'} {...register('discountValue')} />
            </Field>
            {type === 'percentage' ? (
              <Field label="Max discount (₹)" htmlFor="promo-cap" error={errors.maxDiscount?.message} hint="Optional cap.">
                <Input id="promo-cap" type="number" inputMode="decimal" step="any" min="0" className="h-12" placeholder="100" {...register('maxDiscount')} />
              </Field>
            ) : (
              <Field label="Minimum fare (₹)" htmlFor="promo-min-flat" error={errors.minFare?.message}>
                <Input id="promo-min-flat" type="number" inputMode="decimal" step="any" min="0" className="h-12" {...register('minFare')} />
              </Field>
            )}
            {type === 'percentage' && (
              <Field label="Minimum fare (₹)" htmlFor="promo-min" error={errors.minFare?.message}>
                <Input id="promo-min" type="number" inputMode="decimal" step="any" min="0" className="h-12" {...register('minFare')} />
              </Field>
            )}
            <Field label="Total redemptions" htmlFor="promo-uses" error={errors.maxUses?.message} hint="Leave blank for unlimited.">
              <Input id="promo-uses" type="number" inputMode="numeric" step="1" min="1" className="h-12" placeholder="Unlimited" {...register('maxUses')} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valid from" htmlFor="promo-from" error={errors.validFrom?.message}>
              <Input id="promo-from" type="datetime-local" className="h-12" {...register('validFrom')} />
            </Field>
            <Field label="Valid until" htmlFor="promo-until" error={errors.validUntil?.message}>
              <Input id="promo-until" type="datetime-local" className="h-12" {...register('validUntil')} />
            </Field>
          </div>

          <label className="flex min-h-[48px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-4 text-sm font-semibold">
            Active
            <Switch checked={active} onCheckedChange={(checked) => setValue('isActive', checked)} aria-label="Active" />
          </label>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" className="h-11" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" className="h-11" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden />} {editing ? 'Save changes' : 'Create code'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
