import Link from 'next/link';

import { LANDING_LINKS } from '@/components/landing/links';
import { Logo } from '@/components/shared/Logo';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@cabgo.app';

export function Footer() {
  return (
    <footer className="dark border-t border-white/10 bg-black text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm text-white/55">{APP_TAGLINE}</p>
          </div>

          <nav aria-label="Explore">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">Explore</h2>
            <ul className="mt-4 space-y-1">
              {LANDING_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="flex min-h-[44px] items-center text-sm font-medium text-white/70 transition-colors hover:text-white md:min-h-[32px]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Account">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white/40">Get started</h2>
            <ul className="mt-4 space-y-1">
              <li>
                <Link
                  href="/sign-up"
                  className="flex min-h-[44px] items-center text-sm font-medium text-white/70 transition-colors hover:text-white md:min-h-[32px]"
                >
                  Create an account
                </Link>
              </li>
              <li>
                <Link
                  href="/sign-in"
                  className="flex min-h-[44px] items-center text-sm font-medium text-white/70 transition-colors hover:text-white md:min-h-[32px]"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="flex min-h-[44px] items-center text-sm font-medium text-white/70 transition-colors hover:text-white md:min-h-[32px]"
                >
                  {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-2 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center">
          <p>
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <p>Ride safe. Ride smart.</p>
        </div>
      </div>
    </footer>
  );
}
