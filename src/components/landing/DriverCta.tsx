import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';

import { Reveal } from '@/components/shared/Reveal';
import { Button } from '@/components/ui/button';
import { APP_NAME, BUSINESS_RULES } from '@/lib/constants';

const PERKS = [
  'Go online with a single tap — accept only the rides you want',
  'Turn-by-turn route preview and live rider location',
  'Earnings dashboard with daily and weekly breakdowns',
  'Ratings and rider feedback that help you improve',
] as const;

/** Illustrative weekly bars (relative heights, not real data). */
const BARS = [38, 52, 44, 68, 60, 92, 78] as const;
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

export function DriverCta() {
  const keep = 100 - BUSINESS_RULES.platformCommissionPercent;

  return (
    <section id="drive" className="scroll-mt-20 px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-brand-gradient p-6 text-white sm:p-12 lg:p-16">
        <div className="bg-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_80%_20%,black,transparent_70%)]" aria-hidden />
        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">For drivers</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Drive with {APP_NAME}.
              <br />
              Keep {keep}% of every fare.
            </h2>
            <ul className="mt-8 space-y-3">
              {PERKS.map((perk) => (
                <li key={perk} className="flex items-start gap-3 text-sm sm:text-base">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  {perk}
                </li>
              ))}
            </ul>
            <Button asChild size="xl" className="mt-10 bg-white text-black hover:bg-white/90">
              <Link href={process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? '/driver' : '/sign-up'}>
                Become a driver <ArrowRight />
              </Link>
            </Button>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="dark rounded-3xl border border-white/15 bg-black/60 p-5 shadow-lift backdrop-blur-xl sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50">This week</p>
                  <p className="font-display text-3xl font-extrabold text-white">Your earnings</p>
                </div>
                <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">Online</span>
              </div>
              <div className="mt-8 flex h-40 items-end justify-between gap-2" role="img" aria-label="Illustrative weekly earnings chart">
                {BARS.map((height, index) => (
                  <div key={index} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-brand-600 to-success"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[11px] font-semibold text-white/50">{DAYS[index]}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-white/40">Illustrative chart — actual earnings vary by city, hours and demand.</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
