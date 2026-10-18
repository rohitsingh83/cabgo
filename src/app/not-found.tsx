import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { CarIllustration } from '@/components/shared/CarIllustration';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="bg-grid relative flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-96 w-96 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" aria-hidden />
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 text-center">
        <p className="font-display text-[7rem] font-extrabold leading-none tracking-tighter text-gradient sm:text-[10rem]">
          404
        </p>
        <div className="-mt-4 w-full max-w-xs sm:max-w-sm">
          <CarIllustration />
        </div>
        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
          Looks like this route doesn&apos;t exist
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          The page you were heading to has moved or never existed. Let&apos;s get you back on the road.
        </p>
        <Button asChild variant="brand" size="lg" className="mt-8">
          <Link href="/">
            <ArrowLeft /> Back to home
          </Link>
        </Button>
      </div>
    </main>
  );
}
