import { BadgeCheck, Clock, ContactRound, ShieldAlert, Siren, Star } from 'lucide-react';

import { Reveal } from '@/components/shared/Reveal';
import { BUSINESS_RULES } from '@/lib/constants';

const POINTS = [
  {
    icon: Siren,
    title: 'One-tap SOS',
    text: 'Press and hold during a ride. Your live location is sent to your emergency contacts and our safety team.',
  },
  {
    icon: ContactRound,
    title: 'Emergency contacts',
    text: 'Save the people who should be alerted first, and update them any time from your profile.',
  },
  {
    icon: BadgeCheck,
    title: 'Verified drivers',
    text: 'Every driver submits licence and vehicle documents that an admin reviews before going online.',
  },
  {
    icon: Clock,
    title: `${Math.round(BUSINESS_RULES.freeCancellationSeconds / 60)}-minute free cancellation`,
    text: 'Changed your mind right after booking? Cancel within the window and pay nothing.',
  },
  {
    icon: Star,
    title: 'Accountable ratings',
    text: 'Both sides rate every trip, and low-rated accounts are flagged for review.',
  },
] as const;

export function SafetySection() {
  return (
    <section id="safety" className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="dark relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-black p-6 text-foreground sm:p-12 lg:p-16">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-destructive/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-brand/20 blur-3xl" aria-hidden />
        <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden />

        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-success">Safety first</p>
              <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Built to get you home safe.
              </h2>
              <p className="mt-4 max-w-lg text-white/65">
                Safety isn&apos;t a feature we bolted on — it&apos;s wired through booking, tracking and support.
              </p>
            </Reveal>

            <ul className="mt-10 space-y-5">
              {POINTS.map((point, index) => {
                const Icon = point.icon;
                return (
                  <Reveal key={point.title} delay={index * 0.07}>
                    <li className="flex gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-success ring-1 ring-white/10">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div>
                        <h3 className="font-bold text-white">{point.title}</h3>
                        <p className="mt-0.5 text-sm text-white/60">{point.text}</p>
                      </div>
                    </li>
                  </Reveal>
                );
              })}
            </ul>
          </div>

          {/* SOS phone mock */}
          <Reveal delay={0.15} className="mx-auto w-full max-w-sm">
            <div className="rounded-[2.5rem] border border-white/15 bg-neutral-950 p-3 shadow-lift">
              <div className="rounded-[2rem] bg-gradient-to-b from-neutral-900 to-black p-6 text-center">
                <div className="mx-auto mb-6 h-1.5 w-20 rounded-full bg-white/15" />
                <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Ride in progress</p>
                <p className="mt-1 font-display text-lg font-bold text-white">Hold SOS if you feel unsafe</p>

                <div className="relative mx-auto my-10 flex h-36 w-36 items-center justify-center">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-destructive/40" />
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-destructive/30 [animation-delay:0.8s]" />
                  <span className="relative flex h-32 w-32 animate-sos items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-lift">
                    <ShieldAlert className="h-12 w-12 text-white" aria-hidden />
                  </span>
                </div>

                <div className="rounded-2xl bg-white/5 p-3 text-left text-xs text-white/70 ring-1 ring-white/10">
                  <p className="font-semibold text-white">Alert sent</p>
                  <p className="mt-0.5">2 emergency contacts and the CabGo safety team can see your live location.</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
