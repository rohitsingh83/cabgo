'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Copy, Loader2, MessageCircle, Phone, Share2, ShieldAlert, ShieldCheck, UserPlus, X } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { EMERGENCY_NUMBER, SOS_COUNTDOWN_SECONDS } from '@/lib/feedback';
import { getBrowserPosition } from '@/lib/geo-client';
import { cn } from '@/lib/utils';
import type { LatLng, SosTriggerResult } from '@/types';

type Stage = 'confirm' | 'countdown' | 'sending' | 'sent' | 'error';

interface SosButtonProps {
  rideId: string;
  /** Used when the device cannot report a position (permission denied, indoors …): the ride's last known spot. */
  fallback: LatLng | null;
  /** Where the user manages emergency contacts (differs per role). */
  contactsHref: string;
  className?: string;
}

/**
 * Emergency button for live trips.
 *
 *  confirm → 5-second cancellable countdown → sending → sent
 *
 * The countdown prevents pocket-presses from raising a real alert, but a "Send now" shortcut skips it when
 * every second counts. The alert is stored server-side first, so even if the SMS provider is down the safety
 * team is told; the dialog then shows exactly which contacts were reached and how to reach the rest.
 * The component restores itself after a page reload (GET /api/sos) so an active alert is never "lost".
 */
export function SosButton({ rideId, fallback, contactsHref, className }: SosButtonProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('confirm');
  const [remaining, setRemaining] = useState(SOS_COUNTDOWN_SECONDS);
  const [result, setResult] = useState<SosTriggerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Restore an alert that is already active (reload / second device).
  useEffect(() => {
    let cancelled = false;
    apiFetch<SosTriggerResult | null>(`/api/sos?rideId=${rideId}`)
      .then((active) => {
        if (!cancelled && active) setResult(active);
      })
      .catch(() => {
        // Not being able to check must never hide the button.
      });
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  const send = useCallback(async () => {
    setStage('sending');
    setError(null);

    let point: LatLng | null = null;
    let source: 'gps' | 'ride' = 'gps';
    try {
      point = await getBrowserPosition({ timeout: 6000, maximumAge: 15_000 });
    } catch {
      point = fallback;
      source = 'ride';
    }
    if (!point) {
      setError(`We couldn't find your location. Call ${EMERGENCY_NUMBER} now, then try again.`);
      setStage('error');
      return;
    }

    try {
      const sent = await apiFetch<SosTriggerResult>('/api/sos', { method: 'POST', body: { rideId, lat: point.lat, lng: point.lng, source } });
      setResult(sent);
      setStage('sent');
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Could not send the alert. Call ${EMERGENCY_NUMBER} now, then try again.`);
      setStage('error');
    }
  }, [fallback, rideId]);

  // Countdown ticks once a second and fires the alert at zero.
  useEffect(() => {
    if (stage !== 'countdown') return;
    if (remaining <= 0) {
      void send();
      return;
    }
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [stage, remaining, send]);

  const openDialog = () => {
    setCopied(false);
    setError(null);
    setRemaining(SOS_COUNTDOWN_SECONDS);
    setStage(result ? 'sent' : 'confirm');
    setOpen(true);
  };

  const onOpenChange = (next: boolean) => {
    // Closing during the countdown cancels it; once sending, keep the dialog (the request is in flight).
    if (!next && stage === 'sending') return;
    if (!next && stage === 'countdown') setStage('confirm');
    setOpen(next);
  };

  const markSafe = async () => {
    if (!result) return;
    setResolving(true);
    try {
      await apiFetch(`/api/sos/${result.alert.id}`, { method: 'PATCH', body: { action: 'resolve' } });
      setResult(null);
      setOpen(false);
      toast({ variant: 'success', title: "Glad you're safe", description: 'The safety team has been told the alert is cleared.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not clear the alert', description: err instanceof ApiClientError ? err.message : 'Please try again.' });
    } finally {
      setResolving(false);
    }
  };

  const copyMessage = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy', description: 'Select and copy the message manually.' });
    }
  };

  const nativeShare = async () => {
    if (!result) return;
    try {
      await navigator.share({ title: 'SOS — I need help', text: result.shareText, url: result.mapUrl });
    } catch {
      // The user dismissed the share sheet — nothing to do.
    }
  };

  const active = Boolean(result);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const unsent = result?.contacts.filter((contact) => !contact.sent) ?? [];

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={cn(
          'relative flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border-2 px-5 text-base font-extrabold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          active ? 'border-destructive bg-destructive text-white' : 'border-destructive/50 bg-destructive/5 text-destructive hover:bg-destructive/10',
          className,
        )}
      >
        {active && <span aria-hidden className="absolute inset-0 animate-pulse-ring rounded-xl border-2 border-destructive" />}
        <ShieldAlert className="h-5 w-5" aria-hidden />
        {active ? 'SOS ACTIVE — tap for details' : 'SOS · Emergency'}
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto rounded-3xl p-5 sm:p-6">
          <AnimatePresence mode="wait" initial={false}>
            {stage === 'confirm' && (
              <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <DialogHeader className="text-left">
                  <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive text-white shadow-glow">
                    <AlertTriangle className="h-7 w-7" aria-hidden />
                  </div>
                  <DialogTitle className="font-display text-2xl font-extrabold">Send an SOS?</DialogTitle>
                  <DialogDescription>
                    We&apos;ll share your live location with CabGo&apos;s safety team and text your emergency contacts. In immediate danger, call {EMERGENCY_NUMBER} first.
                  </DialogDescription>
                </DialogHeader>
                <a href={`tel:${EMERGENCY_NUMBER}`} className={cn(buttonVariants({ variant: 'destructive' }), 'h-14 w-full text-base font-bold')}>
                  <Phone aria-hidden /> Call {EMERGENCY_NUMBER} (police / ambulance)
                </a>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-12"
                    onClick={() => {
                      setRemaining(SOS_COUNTDOWN_SECONDS);
                      setStage('countdown');
                    }}
                  >
                    Send SOS
                  </Button>
                  <Button variant="ghost" className="h-12" onClick={() => setOpen(false)}>
                    Not now
                  </Button>
                </div>
                <button type="button" onClick={() => void send()} className="mx-auto block min-h-[44px] text-sm font-semibold text-destructive underline-offset-4 hover:underline">
                  Send immediately, skip countdown
                </button>
              </motion.div>
            )}

            {stage === 'countdown' && (
              <motion.div key="countdown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5 text-center">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl font-extrabold">Sending SOS in…</DialogTitle>
                  <DialogDescription>Tap cancel if this was a mistake.</DialogDescription>
                </DialogHeader>
                <div className="relative mx-auto flex h-40 w-40 items-center justify-center" role="timer" aria-live="assertive" aria-label={`${remaining} seconds`}>
                  <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
                    <circle cx="50" cy="50" r="46" fill="none" strokeWidth="6" className="stroke-muted" />
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      strokeWidth="6"
                      strokeLinecap="round"
                      className="stroke-destructive transition-[stroke-dashoffset] duration-1000 ease-linear"
                      strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={(2 * Math.PI * 46 * (SOS_COUNTDOWN_SECONDS - remaining)) / SOS_COUNTDOWN_SECONDS}
                    />
                  </svg>
                  <span className="font-display text-6xl font-extrabold tabular-nums text-destructive">{remaining}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-14 text-base font-bold" onClick={() => setStage('confirm')}>
                    <X aria-hidden /> Cancel
                  </Button>
                  <Button variant="destructive" className="h-14 text-base font-bold" onClick={() => void send()}>
                    Send now
                  </Button>
                </div>
              </motion.div>
            )}

            {stage === 'sending' && (
              <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 py-6 text-center" role="status">
                <DialogHeader>
                  <DialogTitle className="font-display text-2xl font-extrabold">Sending your alert…</DialogTitle>
                  <DialogDescription>Getting your location and alerting the safety team.</DialogDescription>
                </DialogHeader>
                <Loader2 className="mx-auto h-12 w-12 animate-spin text-destructive" aria-hidden />
              </motion.div>
            )}

            {stage === 'error' && (
              <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <DialogHeader className="text-left">
                  <DialogTitle className="font-display text-2xl font-extrabold">Alert not sent</DialogTitle>
                  <DialogDescription>{error}</DialogDescription>
                </DialogHeader>
                <a href={`tel:${EMERGENCY_NUMBER}`} className={cn(buttonVariants({ variant: 'destructive' }), 'h-14 w-full text-base font-bold')}>
                  <Phone aria-hidden /> Call {EMERGENCY_NUMBER}
                </a>
                <Button variant="outline" className="h-12 w-full" onClick={() => void send()}>
                  Try again
                </Button>
              </motion.div>
            )}

            {stage === 'sent' && result && (
              <motion.div key="sent" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                <DialogHeader className="text-left">
                  <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive text-white shadow-glow">
                    <ShieldAlert className="h-7 w-7" aria-hidden />
                  </div>
                  <DialogTitle className="font-display text-2xl font-extrabold">SOS is active</DialogTitle>
                  <DialogDescription>CabGo&apos;s safety team has your location. Stay on the line if they call you.</DialogDescription>
                </DialogHeader>

                <a href={`tel:${EMERGENCY_NUMBER}`} className={cn(buttonVariants({ variant: 'destructive' }), 'h-14 w-full text-base font-bold')}>
                  <Phone aria-hidden /> Call {EMERGENCY_NUMBER}
                </a>

                <section aria-label="Emergency contacts" className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your contacts</h3>
                  {result.contacts.length === 0 ? (
                    <Link href={contactsHref} className="flex min-h-[56px] items-center gap-3 rounded-xl border border-dashed border-border px-4 text-sm hover:border-brand">
                      <UserPlus className="h-5 w-5 text-brand" aria-hidden /> You have no emergency contacts yet — add one
                    </Link>
                  ) : (
                    <ul className="space-y-2">
                      {result.contacts.map((contact) => (
                        <li key={contact.phone} className="flex items-center gap-3 rounded-xl border border-border p-3">
                          <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', contact.sent ? 'bg-success/15 text-success' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400')}>
                            {contact.sent ? <Check className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{contact.name}</p>
                            <p className="text-xs text-muted-foreground">{contact.sent ? 'Message sent' : 'Not sent automatically'}</p>
                          </div>
                          {!contact.sent && (
                            <a
                              href={`sms:${contact.phone}?body=${encodeURIComponent(result.shareText)}`}
                              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-11')}
                            >
                              Text them
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {(!result.smsConfigured || unsent.length > 0) && (
                  <section aria-label="Share your location" className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Share your location</h3>
                    <div className={cn("grid gap-2", canShare ? "grid-cols-3" : "grid-cols-2")}>
                      {canShare && (
                        <Button variant="outline" className="h-12 flex-col gap-0.5 px-1 text-xs" onClick={() => void nativeShare()}>
                          <Share2 aria-hidden /> Share
                        </Button>
                      )}
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(result.shareText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: 'outline' }), 'h-12 flex-col gap-0.5 px-1 text-xs')}
                      >
                        <MessageCircle aria-hidden /> WhatsApp
                      </a>
                      <Button variant="outline" className="h-12 flex-col gap-0.5 px-1 text-xs" onClick={() => void copyMessage()}>
                        {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </section>
                )}

                <Button variant="outline" className="h-12 w-full border-success/40 text-success hover:bg-success/10 hover:text-success" onClick={() => void markSafe()} disabled={resolving}>
                  {resolving ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
                  I&apos;m safe — clear the alert
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
