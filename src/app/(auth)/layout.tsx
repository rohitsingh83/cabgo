import type { ReactNode } from 'react';
import Link from 'next/link';
import { ShieldCheck, Star, Timer } from 'lucide-react';

import { CarIllustration } from '@/components/shared/CarIllustration';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { APP_NAME } from '@/lib/constants';

const HIGHLIGHTS = [
  { icon: Timer, value: '< 3 min', label: 'Average pickup' },
  { icon: Star, value: '4.9', label: 'Driver rating' },
  { icon: ShieldCheck, value: '24×7', label: 'SOS & support' },
] as const;

/**
 * Split-screen shell for /sign-in and /sign-up:
 *  - left (≥lg): animated gradient brand panel with the floating car
 *  - right: the Clerk form (full-width on mobile with a compact header)
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* ---------------------------------------------------------------- brand panel */}
      <aside className="hero-bg relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />
        <div className="pointer-events-none absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-brand/40 blur-[120px]" aria-hidden />
        <div className="pointer-events-none absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-brand-purple/40 blur-[130px]" aria-hidden />

        <div className="relative z-10">
          <Logo tone="light" size="lg" />
        </div>

        <div className="relative z-10 space-y-10">
          <div className="space-y-4">
            <h1 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl">
              Your city. Your ride.
              <span className="block text-gradient-green">On demand.</span>
            </h1>
            <p className="max-w-md text-base text-white/70">
              Sedans, SUVs, autos and bikes with live tracking, upfront fares and a safety net that
              never sleeps.
            </p>
          </div>

          <div className="relative mx-auto max-w-lg">
            <CarIllustration />
            {/* animated road */}
            <div className="road-line absolute inset-x-0 -bottom-1 h-1 rounded-full opacity-60" aria-hidden />
          </div>

          <dl className="grid max-w-lg grid-cols-3 gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <Icon className="mb-2 h-4 w-4 text-brand-400" aria-hidden />
                <dt className="sr-only">{label}</dt>
                <dd className="text-xl font-bold">{value}</dd>
                <p className="text-xs text-white/60">{label}</p>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
      </aside>

      {/* ---------------------------------------------------------------- form panel */}
      <main className="relative flex min-h-screen flex-col bg-background">
        <header className="flex items-center justify-between p-4 sm:p-6">
          <div className="lg:invisible">
            <Logo />
          </div>
          <ThemeToggle />
        </header>

        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-8">
          <div className="w-full max-w-md animate-fade-in">{children}</div>
        </div>

        <footer className="px-6 pb-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{' '}
          <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
            Terms
          </Link>{' '}
          and{' '}
          <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </footer>
      </main>
    </div>
  );
}
