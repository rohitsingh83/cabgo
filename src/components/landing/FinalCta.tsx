import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

import { Reveal } from '@/components/shared/Reveal';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';

interface FinalCtaProps {
  dashboardHref: string | null;
}

export function FinalCta({ dashboardHref }: FinalCtaProps) {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="absolute left-1/2 top-1/2 -z-10 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-3xl" aria-hidden />
      <Reveal className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="font-display text-4xl font-extrabold tracking-tighter sm:text-5xl lg:text-6xl">
          Ready when <span className="text-gradient">you are.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Join {APP_NAME} today — your first booking is just a few taps away.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          {dashboardHref ? (
            <Button asChild variant="brand" size="xl" className="btn-glow">
              <Link href={dashboardHref}>
                Open dashboard <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="brand" size="xl" className="btn-glow">
                <Link href="/sign-up">
                  Create free account <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="xl">
                <Link href="/sign-in">I already have an account</Link>
              </Button>
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
}
