'use client';

import { useState, type FormEvent } from 'react';
import { BadgePercent, CheckCircle2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn, formatCurrency } from '@/lib/utils';
import { promoCodeSchema } from '@/lib/validations';

interface PromoInputProps {
  /** Code currently applied to the quote (null when none). */
  appliedCode: string | null;
  /** Server verdict for `appliedCode` (undefined while a quote is loading). */
  result?: { valid: boolean; message: string } | null;
  /** Amount saved on the selected ride (shown when valid). */
  savings?: number;
  /** True while the quote with the new code is being fetched. */
  checking?: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}

/** Promo code entry → applied chip. Validation happens on the server as part of the quote. */
export function PromoInput({ appliedCode, result, savings = 0, checking = false, onApply, onRemove }: PromoInputProps) {
  const [value, setValue] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = promoCodeSchema.safeParse(value);
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? 'Enter a valid promo code');
      return;
    }
    setLocalError(null);
    onApply(parsed.data);
    setValue('');
  };

  if (appliedCode) {
    const valid = result?.valid === true;
    const pending = checking || !result;
    return (
      <div
        className={cn(
          'flex min-h-[52px] items-center justify-between gap-3 rounded-xl border px-3 py-2',
          pending && 'border-border bg-muted/50',
          !pending && valid && 'border-success/40 bg-success/10',
          !pending && !valid && 'border-destructive/40 bg-destructive/10',
        )}
        role="status"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {valid && !pending ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
          ) : (
            <BadgePercent className={cn('h-5 w-5 shrink-0', pending ? 'text-muted-foreground' : 'text-destructive')} aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide">{appliedCode}</p>
            <p className="truncate text-xs text-muted-foreground">
              {pending ? 'Checking code…' : valid ? `You save ${formatCurrency(savings)} on this ride` : result?.message}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove promo code"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="promo-code" className="sr-only">
        Promo code
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <BadgePercent className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="promo-code"
            value={value}
            onChange={(event) => {
              setValue(event.target.value.toUpperCase());
              setLocalError(null);
            }}
            placeholder="Have a promo code?"
            maxLength={32}
            autoCapitalize="characters"
            autoComplete="off"
            aria-invalid={Boolean(localError)}
            aria-describedby={localError ? 'promo-error' : undefined}
            className="h-12 w-full rounded-xl border border-input bg-muted/50 pl-10 pr-3 text-sm font-semibold uppercase tracking-wide outline-none transition-all placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:border-brand focus:bg-background focus:ring-2 focus:ring-brand/30"
          />
        </div>
        <Button type="submit" variant="outline" className="h-12 px-5" disabled={value.trim().length === 0}>
          Apply
        </Button>
      </div>
      {localError && (
        <p id="promo-error" className="mt-1.5 text-xs font-medium text-destructive">
          {localError}
        </p>
      )}
    </form>
  );
}
