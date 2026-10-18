'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu } from 'lucide-react';

import { LANDING_LINKS } from '@/components/landing/links';
import { Logo } from '@/components/shared/Logo';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface NavbarProps {
  /** Dashboard (or onboarding) URL when the visitor is signed in; null when signed out. */
  dashboardHref: string | null;
}

/**
 * Landing navbar. It floats transparently over the (always dark) hero and switches to a
 * frosted bar once the page scrolls. While transparent we add the `dark` class so every
 * semantic token (logo text, buttons, toggle) automatically flips to its light-on-dark form.
 */
export function Navbar({ dashboardHref }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 text-foreground transition-all duration-300',
        scrolled ? 'border-b border-border bg-background/80 shadow-soft backdrop-blur-xl' : 'dark border-b border-transparent',
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {LANDING_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex min-h-[44px] items-center rounded-xl px-3.5 text-sm font-semibold text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          {dashboardHref ? (
            <Button asChild variant="brand" className="hidden sm:inline-flex">
              <Link href={dashboardHref}>
                Open dashboard <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild variant="brand" className="hidden sm:inline-flex">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="!size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">Site navigation</SheetDescription>
              <Logo />
              <nav aria-label="Mobile" className="mt-8 flex flex-1 flex-col gap-1">
                {LANDING_LINKS.map((link) => (
                  <SheetClose asChild key={link.href}>
                    <a
                      href={link.href}
                      className="flex min-h-[48px] items-center rounded-xl px-3 text-base font-semibold hover:bg-accent"
                    >
                      {link.label}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <div className="grid gap-2 pt-4">
                {dashboardHref ? (
                  <Button asChild variant="brand" size="lg">
                    <Link href={dashboardHref}>Open dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="brand" size="lg">
                      <Link href="/sign-up">Get started</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link href="/sign-in">Sign in</Link>
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
