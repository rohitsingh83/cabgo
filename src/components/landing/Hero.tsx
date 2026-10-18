'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight, BadgeCheck, Navigation, ShieldCheck } from 'lucide-react';

import { FareEstimator } from '@/components/landing/FareEstimator';
import { CarIllustration } from '@/components/shared/CarIllustration';
import { Button } from '@/components/ui/button';
import { APP_NAME, BUSINESS_RULES } from '@/lib/constants';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const STATS = [
  { value: `${BUSINESS_RULES.matchingRadiusKm} km`, label: 'Driver match radius' },
  { value: `${Math.round(BUSINESS_RULES.freeCancellationSeconds / 60)} min`, label: 'Free cancellation' },
  { value: '24×7', label: 'One-tap SOS' },
  { value: '4', label: 'Ride types' },
] as const;

/** Floating glass chip hovering around the estimator card. */
function FloatChip({
  className,
  delay,
  children,
}: {
  className: string;
  delay: number;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className={`absolute z-10 hidden items-center gap-2 rounded-2xl border border-white/15 bg-black/60 px-3.5 py-2.5 text-xs font-semibold text-white shadow-lift backdrop-blur-xl xl:flex ${className}`}
      animate={reduce ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {children}
    </motion.div>
  );
}

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="dark relative isolate overflow-hidden bg-black text-foreground">
      {/* Layered backdrop: animated gradient → grid → vignette */}
      <div className="hero-bg absolute inset-0 -z-20 opacity-80" aria-hidden />
      <div
        className="bg-grid absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_50%_30%,black,transparent_75%)]"
        aria-hidden
      />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-black to-transparent" aria-hidden />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-8 lg:pb-24 lg:pt-36">
        <motion.div variants={container} initial="hidden" animate="show">
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/80 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Live tracking · Upfront fares · 24×7 SOS
            </span>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-6 font-display text-5xl font-extrabold leading-[1.02] tracking-tighter text-white sm:text-6xl lg:text-7xl"
          >
            Your city,
            <br />
            <span className="text-gradient-green">one tap away.</span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            {APP_NAME} connects you with verified drivers nearby — bikes, autos, sedans and SUVs — with
            multi-stop trips, transparent surge pricing and live tracking from pickup to drop.
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="brand" size="xl" className="btn-glow">
              <Link href={process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? '/rider' : '/sign-up'}>
                Book a ride <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="xl"
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
            >
              <Link href={process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? '/driver' : '#drive'}>
                Drive with {APP_NAME}
              </Link>
            </Button>
          </motion.div>

          <motion.dl variants={item} className="mt-12 grid max-w-xl grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <p className="font-display text-2xl font-extrabold text-white">{stat.value}</p>
                  <p className="text-xs font-medium text-white/50">{stat.label}</p>
                </dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <FloatChip className="-top-7 left-8" delay={0}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/20 text-success">
              <Navigation className="h-4 w-4" />
            </span>
            Driver arriving · 3 min
          </FloatChip>
          <FloatChip className="-top-7 right-4" delay={1.2}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/20 text-brand-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
            Fare locked at booking
          </FloatChip>
          <FloatChip className="-bottom-6 left-12" delay={2.2}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-purple/25 text-violet-300">
              <BadgeCheck className="h-4 w-4" />
            </span>
            Admin-verified drivers
          </FloatChip>
          <FareEstimator />
        </motion.div>
      </div>

      {/* Animated road: the car cruises across while dashes scroll beneath it */}
      <div className="relative h-32 overflow-hidden border-t border-white/10" aria-hidden>
        <div className="absolute inset-x-0 bottom-0 h-12 bg-neutral-950" />
        <div className="road-line absolute inset-x-0 bottom-5 h-1" />
        <motion.div
          className="absolute bottom-6 w-44 sm:w-56"
          initial={{ x: '-30vw' }}
          animate={reduce ? { x: '12vw' } : { x: ['-30vw', '110vw'] }}
          transition={reduce ? undefined : { duration: 16, repeat: Infinity, ease: 'linear' }}
        >
          <CarIllustration floating={false} />
        </motion.div>
      </div>
    </section>
  );
}
