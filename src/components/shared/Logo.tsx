import Link from 'next/link';

import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** Render only the mark (collapsed sidebar, favicons). */
  iconOnly?: boolean;
  /** `light` forces white text — use on dark / gradient backgrounds. */
  tone?: 'auto' | 'light';
  size?: 'sm' | 'md' | 'lg';
  /** Wrap in a link to the landing page (default true). Set to false inside other links. */
  asLink?: boolean;
  className?: string;
}

const sizes = {
  sm: { box: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4', text: 'text-lg' },
  md: { box: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5', text: 'text-xl' },
  lg: { box: 'h-12 w-12 rounded-2xl', icon: 'h-6 w-6', text: 'text-2xl' },
} as const;

/** Brand mark: gradient tile with a pin-shaped route glyph + wordmark. */
export function Logo({ iconOnly = false, tone = 'auto', size = 'md', asLink = true, className }: LogoProps) {
  const s = sizes[size];

  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative flex shrink-0 items-center justify-center bg-brand-gradient shadow-glow',
          s.box,
        )}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" fill="none" className={cn('text-white', s.icon)}>
          {/* map pin */}
          <path
            d="M12 2.5c-3.6 0-6.5 2.8-6.5 6.4 0 4.6 5.1 10.2 5.9 11.1a.8.8 0 0 0 1.2 0c.8-.9 5.9-6.5 5.9-11.1 0-3.6-2.9-6.4-6.5-6.4Z"
            fill="currentColor"
            fillOpacity="0.95"
          />
          {/* route chevron inside the pin */}
          <path
            d="m9.3 10.9 2.7-2.6 2.7 2.6M12 8.5v4.4"
            stroke="url(#cg-logo-inner)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <defs>
            <linearGradient id="cg-logo-inner" x1="9" y1="8" x2="15" y2="13" gradientUnits="userSpaceOnUse">
              <stop stopColor="#2563eb" />
              <stop offset="1" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      {!iconOnly && (
        <span
          className={cn(
            'font-display font-extrabold tracking-tight',
            s.text,
            tone === 'light' ? 'text-white' : 'text-foreground',
          )}
        >
          {APP_NAME}
        </span>
      )}
    </span>
  );

  if (!asLink) return content;
  return (
    <Link href="/" aria-label={`${APP_NAME} home`} className="inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  );
}
