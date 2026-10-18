import {
  BadgePercent,
  Bell,
  Bookmark,
  CreditCard,
  LifeBuoy,
  type LucideIcon,
  Moon,
  Receipt,
  Route,
  Star,
  TrendingUp,
  Zap,
} from 'lucide-react';

import { SectionHeading } from '@/components/landing/VehicleShowcase';
import { Reveal } from '@/components/shared/Reveal';
import { BUSINESS_RULES, MAX_STOPS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Tailwind gradient stops for the icon tile. */
  tone: string;
  className?: string;
}

const FEATURES: readonly Feature[] = [
  {
    icon: Route,
    title: 'Multi-stop trips',
    description: `Add up to ${MAX_STOPS} stops on the way. Drag to reorder — the fare updates instantly.`,
    tone: 'from-blue-500 to-indigo-500',
  },
  {
    icon: TrendingUp,
    title: 'Transparent surge',
    description: 'When demand outpaces drivers, you see the multiplier before you confirm. No surprises.',
    tone: 'from-amber-500 to-orange-500',
  },
  {
    icon: Zap,
    title: 'Smart matching',
    description: `The nearest available driver within ${BUSINESS_RULES.matchingRadiusKm} km gets your request first.`,
    tone: 'from-emerald-500 to-teal-500',
  },
  {
    icon: BadgePercent,
    title: 'Promo codes',
    description: 'Apply a code at checkout and watch the discount land in your fare breakdown.',
    tone: 'from-pink-500 to-rose-500',
  },
  {
    icon: CreditCard,
    title: 'Secure card payments',
    description: 'Pay with Stripe — cards, UPI and wallets — or choose cash. Receipts are emailed automatically.',
    tone: 'from-violet-500 to-purple-600',
    className: 'lg:col-span-2',
  },
  {
    icon: Bookmark,
    title: 'Saved places',
    description: 'Home, work and your favourite spots — one tap to set as pickup or drop.',
    tone: 'from-cyan-500 to-sky-500',
  },
  {
    icon: Star,
    title: 'Two-way ratings',
    description: 'Rate every trip with tags and feedback. Great drivers rise to the top.',
    tone: 'from-yellow-400 to-amber-500',
  },
  {
    icon: LifeBuoy,
    title: 'Support tickets',
    description: 'Lost an item or disputed a charge? Raise a ticket and track it to resolution.',
    tone: 'from-sky-500 to-blue-600',
  },
  {
    icon: Bell,
    title: 'Real-time alerts',
    description: 'Driver accepted, arriving, ride started, payment received — instantly, in-app and by email.',
    tone: 'from-fuchsia-500 to-pink-500',
  },
  {
    icon: Moon,
    title: 'Light & dark mode',
    description: 'Easy on the eyes at 2 AM and in bright sun. Follows your device or your choice.',
    tone: 'from-slate-600 to-slate-900',
  },
  {
    icon: Receipt,
    title: 'Full trip history',
    description: 'Every ride, receipt and rating in one searchable timeline.',
    tone: 'from-green-500 to-emerald-600',
  },
];

/** Decorative live-tracking mock: animated route with a car dot gliding along it. */
function LiveTrackingVisual() {
  const route = 'M 40 210 C 120 210, 110 120, 200 120 S 300 60, 370 70';
  return (
    <div className="relative mt-6 overflow-hidden rounded-2xl border border-border bg-muted/60">
      <svg viewBox="0 0 420 260" className="h-auto w-full" role="img" aria-label="Animated route preview">
        <defs>
          <pattern id="map-grid" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
          </pattern>
          <linearGradient id="route-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <rect width="420" height="260" fill="url(#map-grid)" />
        {/* "Blocks" */}
        <rect x="70" y="150" width="60" height="40" rx="8" fill="hsl(var(--border))" opacity="0.5" />
        <rect x="230" y="150" width="90" height="50" rx="8" fill="hsl(var(--border))" opacity="0.5" />
        <rect x="140" y="30" width="70" height="46" rx="8" fill="hsl(var(--border))" opacity="0.5" />
        <rect x="290" y="110" width="60" height="30" rx="8" fill="hsl(var(--border))" opacity="0.5" />

        <path d={route} fill="none" stroke="hsl(var(--background))" strokeWidth="10" strokeLinecap="round" />
        <path d={route} fill="none" stroke="url(#route-grad)" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 10" />

        {/* Pickup */}
        <circle cx="40" cy="210" r="9" fill="#22c55e" />
        <circle cx="40" cy="210" r="16" fill="#22c55e" opacity="0.25">
          <animate attributeName="r" values="10;22;10" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2.4s" repeatCount="indefinite" />
        </circle>
        {/* Drop */}
        <rect x="360" y="60" width="20" height="20" rx="5" fill="#2563eb" />

        {/* Moving car */}
        <g>
          <circle r="13" fill="#fff" stroke="#2563eb" strokeWidth="3" />
          <circle r="5" fill="#2563eb" />
          <animateMotion dur="7s" repeatCount="indefinite" path={route} />
        </g>
      </svg>

      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl border border-border bg-background/90 px-3 py-2 text-xs font-semibold shadow-soft backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        Arriving in 4 min · 1.2 km away
      </div>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <section id="features" className="scroll-mt-20 border-y border-border bg-muted/40 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Everything built in"
          title="Everything you need from a ride. Nothing you don't."
          description="Real-time tracking, honest pricing and safety tools — designed mobile-first for riders, drivers and admins."
        />

        <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* Hero feature spans a 2×2 block on large screens */}
          <Reveal className="md:col-span-2 lg:row-span-2">
            <article className="card-hover relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                <Route className="h-6 w-6" aria-hidden />
              </div>
              <h3 className="mt-5 font-display text-2xl font-extrabold">Live tracking, second by second</h3>
              <p className="mt-2 max-w-md text-muted-foreground">
                Watch your driver glide toward you on the map with a live ETA — from the moment they accept
                until you&apos;re dropped off. Location updates every {BUSINESS_RULES.locationIntervalMs / 1000}{' '}
                seconds.
              </p>
              <LiveTrackingVisual />
            </article>
          </Reveal>

          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Reveal key={feature.title} delay={(index % 4) * 0.06} className={cn(feature.className)}>
                <article className="card-hover group relative h-full overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-soft">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.tone} text-white shadow-soft transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
