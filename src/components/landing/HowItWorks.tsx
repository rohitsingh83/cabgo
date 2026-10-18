import { CreditCard, MapPin, Navigation } from 'lucide-react';

import { SectionHeading } from '@/components/landing/VehicleShowcase';
import { Reveal } from '@/components/shared/Reveal';

const STEPS = [
  {
    icon: MapPin,
    title: 'Set your route',
    description:
      'Search pickup, drop and up to three stops — or tap a saved place. We show the route and a fare before you commit.',
  },
  {
    icon: Navigation,
    title: 'Get matched & track',
    description:
      'The closest verified driver accepts, and you follow their car live on the map with an ETA that updates in real time.',
  },
  {
    icon: CreditCard,
    title: 'Ride, pay, rate',
    description:
      'Pay securely in-app or by cash, receive an emailed receipt, and rate your driver in a couple of taps.',
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="How it works" title="From “where to?” to “you've arrived” in three steps" />

        <ol className="relative mt-16 grid gap-10 lg:grid-cols-3 lg:gap-8">
          {/* Connector line (desktop) */}
          <div
            className="absolute left-[16%] right-[16%] top-8 hidden h-px bg-gradient-to-r from-transparent via-border to-transparent lg:block"
            aria-hidden
          />
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={index * 0.12}>
                <li className="relative text-center">
                  <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-glow">
                    <Icon className="h-7 w-7" aria-hidden />
                    <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-foreground text-xs font-extrabold text-background">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-6 font-display text-xl font-extrabold">{step.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </li>
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
