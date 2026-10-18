'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

interface RideOtpCardProps {
  otp: string;
}

export function RideOtpCard({ otp }: RideOtpCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(otp);
      setCopied(true);
      toast({
        title: 'PIN copied',
        description: `Ride verification code ${otp} copied to clipboard.`,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const digits = otp.split('');

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-4 shadow-md sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-bold tracking-tight text-foreground sm:text-base">
                Ride Start PIN
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> Secure OTP
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Share with your driver to start the trip
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="h-8 gap-1.5 px-2.5 text-xs font-semibold"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>

      {/* 4-digit Display Boxes */}
      <div className="mt-3.5 flex items-center justify-center gap-2.5 sm:gap-3">
        {digits.map((digit, idx) => (
          <div
            key={idx}
            className="flex h-12 w-11 items-center justify-center rounded-xl border border-primary/40 bg-card font-mono text-2xl font-black text-primary shadow-inner sm:h-14 sm:w-13 sm:text-3xl"
          >
            {digit}
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground sm:text-xs">
        Your driver will ask for this code before departing from the pickup location.
      </p>
    </Card>
  );
}
