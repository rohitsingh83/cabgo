'use client';

import { useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface ConfirmReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  /** `destructive` for suspend / cancel / reject; `brand` for neutral confirmations. */
  tone?: 'destructive' | 'brand';
  /** Shows a reason box; `minLength > 0` makes it mandatory. Omit to ask for a plain confirmation. */
  reason?: { label: string; placeholder: string; minLength: number; maxLength: number };
  /** Resolve to an error message to keep the dialog open, or `null` on success. */
  onConfirm: (reason: string) => Promise<string | null>;
}

/**
 * Shared "are you sure?" dialog for admin actions that need an explanation (suspend a user, reject a driver,
 * cancel a ride). Validation of the reason is repeated server-side (Zod); this keeps the UX immediate.
 */
export function ConfirmReasonDialog({ open, onOpenChange, title, description, confirmLabel, tone = 'destructive', reason, onConfirm }: ConfirmReasonDialogProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = text.trim();
    if (reason && trimmed.length < reason.minLength) {
      setError(`Please write at least ${reason.minLength} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await onConfirm(trimmed);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setText('');
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (!next) {
          setError(null);
          setText('');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-8 font-display text-xl font-extrabold">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {reason && (
          <div className="space-y-1.5">
            <label htmlFor="confirm-reason" className="text-sm font-semibold">
              {reason.label}
              {reason.minLength === 0 && <span className="font-normal text-muted-foreground"> (optional)</span>}
            </label>
            <Textarea id="confirm-reason" rows={3} value={text} maxLength={reason.maxLength} placeholder={reason.placeholder} onChange={(event) => setText(event.target.value)} disabled={busy} className="resize-none" />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {text.length}/{reason.maxLength}
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" className="h-11" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone === 'destructive' ? 'destructive' : 'brand'} className="h-11" onClick={() => void submit()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />} {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
