'use client';

import { useEffect, useState } from 'react';
import { useClerk } from '@/lib/auth/clerk-client';
import { LogOut, Monitor, Moon, ShieldCheck, Sun, UserCog, type LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';

import { Button } from '@/components/ui/button';
import { roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface SettingsPanelProps {
  email: string | null;
  role: UserRole;
}

const THEMES: { value: 'light' | 'dark' | 'system'; label: string; icon: LucideIcon; preview: string }[] = [
  { value: 'light', label: 'Light', icon: Sun, preview: 'bg-white border-neutral-200 text-neutral-900' },
  { value: 'dark', label: 'Dark', icon: Moon, preview: 'bg-[#0A0A0A] border-neutral-800 text-white' },
  { value: 'system', label: 'System', icon: Monitor, preview: 'bg-gradient-to-r from-white to-[#0A0A0A] border-neutral-400 text-neutral-500' },
];

/** Appearance, account management (Clerk) and sign-out. Shared by rider and driver settings. */
export function SettingsPanel({ email, role }: SettingsPanelProps) {
  const { theme, setTheme } = useTheme();
  const { openUserProfile, signOut } = useClerk();
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // next-themes only knows the real theme on the client — avoid a hydration mismatch.
  useEffect(() => setMounted(true), []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut({ redirectUrl: '/' });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-card p-6" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="font-display text-lg font-extrabold">
          Appearance
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">Choose how CabGo looks on this device.</p>

        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
          {THEMES.map(({ value, label, icon: Icon, preview }) => {
            const active = mounted && theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(value)}
                className={cn(
                  'flex min-h-[44px] flex-col gap-3 rounded-2xl border-2 p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-brand bg-brand/5' : 'border-border hover:border-foreground/20',
                )}
              >
                <span className={cn('flex h-14 items-center justify-center rounded-lg border', preview)}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6" aria-labelledby="account-heading">
        <h2 id="account-heading" className="font-display text-lg font-extrabold">
          Account &amp; security
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Signed in{email ? ` as ${email}` : ''} · {roleLabel(role)}
        </p>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
              <div>
                <p className="text-sm font-semibold">Sign-in methods &amp; password</p>
                <p className="text-xs text-muted-foreground">Email, phone, Google and GitHub are managed in your account portal.</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => openUserProfile()} className="shrink-0">
              <UserCog aria-hidden /> Manage account
            </Button>
          </div>

          <Button
            variant="outline"
            onClick={handleSignOut}
            disabled={signingOut}
            className="h-12 w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut aria-hidden /> {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </section>
    </div>
  );
}
