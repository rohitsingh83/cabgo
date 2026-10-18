'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';

import { SectionHeading } from '@/components/landing/VehicleShowcase';
import { BUSINESS_RULES } from '@/lib/constants';
import { cn, formatCurrency } from '@/lib/utils';

const FREE_MINUTES = Math.round(BUSINESS_RULES.freeCancellationSeconds / 60);

const FAQS = [
  {
    q: 'How is my fare calculated?',
    a: 'Fare = base fare + distance + time, with a minimum fare per vehicle. Stops, a small booking fee and GST are added, and surge may apply when demand is high. You see the full breakdown before you confirm, and the price is locked at booking.',
  },
  {
    q: 'What is surge pricing and when does it apply?',
    a: 'When there are many more ride requests than available drivers nearby, a multiplier (up to 3×) is applied to the ride portion of the fare to attract more drivers. The multiplier is always shown before you book.',
  },
  {
    q: 'Can I cancel a ride?',
    a: `Yes. Cancel within ${FREE_MINUTES} minutes of a driver accepting and it's free. After that a ${formatCurrency(BUSINESS_RULES.cancellationFee)} cancellation fee may apply to compensate the driver. Cancelling while still searching is always free.`,
  },
  {
    q: 'How do payments work?',
    a: 'Pay by card, UPI or wallet through Stripe, or choose cash. Card details never touch our servers. A receipt is emailed as soon as the ride completes.',
  },
  {
    q: 'What happens when I press SOS?',
    a: 'An alert with your live location is created instantly and shared with your emergency contacts and the CabGo safety team, who can see and resolve it from the admin dashboard.',
  },
  {
    q: 'How do I become a driver?',
    a: 'Sign up, choose “Driver” during onboarding, add your licence and vehicle details, and upload your documents. Once an admin approves your profile you can go online and start accepting rides.',
  },
] as const;

/** Accessible accordion — one open at a time, animated height via Framer Motion. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 border-t border-border bg-muted/40 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />

        <div className="mt-12 space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div
                key={faq.q}
                className={cn(
                  'overflow-hidden rounded-2xl border bg-card transition-colors',
                  isOpen ? 'border-brand/40 shadow-soft' : 'border-border',
                )}
              >
                <h3>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${index}`}
                    id={`faq-trigger-${index}`}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex min-h-[56px] w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    {faq.q}
                    <Plus
                      className={cn(
                        'h-5 w-5 shrink-0 text-brand transition-transform duration-300',
                        isOpen && 'rotate-45',
                      )}
                      aria-hidden
                    />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${index}`}
                      role="region"
                      aria-labelledby={`faq-trigger-${index}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:text-base">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
