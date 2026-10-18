import { cn } from '@/lib/utils';

interface CarIllustrationProps {
  className?: string;
  /** Gentle bobbing animation (disabled automatically for reduced-motion users). */
  floating?: boolean;
}

/**
 * Stylised side-view car drawn as inline SVG (no network, themeable, crisp at any size).
 * Used on the landing hero and the auth showcase panel.
 */
export function CarIllustration({ className, floating = true }: CarIllustrationProps) {
  return (
    <svg
      viewBox="0 0 560 260"
      role="img"
      aria-label="Illustration of a CabGo sedan"
      className={cn('w-full drop-shadow-2xl', floating && 'animate-float', className)}
    >
      <defs>
        <linearGradient id="cg-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="cg-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="cg-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cg-underglow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cg-beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cg-rim" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e5e7eb" />
          <stop offset="100%" stopColor="#6b7280" />
        </radialGradient>
      </defs>

      {/* ground glow + shadow */}
      <ellipse cx="280" cy="228" rx="230" ry="26" fill="url(#cg-underglow)" />
      <ellipse cx="280" cy="226" rx="200" ry="9" fill="#000" opacity="0.35" />

      {/* headlight beam */}
      <path d="M492 168 L560 140 L560 208 Z" fill="url(#cg-beam)" />

      {/* body */}
      <path
        d="M52 188c0-16 8-27 28-32l52-12 40-46c9-10 22-16 38-16h118c17 0 32 7 44 19l38 41 62 12c18 4 28 14 28 30v12c0 8-6 14-14 14H66c-8 0-14-6-14-14v-8Z"
        fill="url(#cg-body)"
      />
      {/* roof shine */}
      <path d="M176 102c9-10 22-16 38-16h118c17 0 32 7 44 19l12 13H162l14-16Z" fill="url(#cg-shine)" />
      {/* belt line */}
      <path d="M70 168h420" stroke="#1e3a8a" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />

      {/* windows */}
      <path d="M170 142l30-36c5-6 12-9 20-9h56v45H170Z" fill="url(#cg-glass)" />
      <path d="M284 97h42c9 0 17 4 23 10l30 35H284V97Z" fill="url(#cg-glass)" />
      <path d="M280 97v45" stroke="#1e3a8a" strokeOpacity="0.5" strokeWidth="5" />

      {/* taxi roof sign */}
      <rect x="262" y="70" width="62" height="18" rx="5" fill="#0a0a0a" />
      <rect x="266" y="73" width="54" height="12" rx="3" fill="#22c55e" />
      <text x="293" y="83" textAnchor="middle" fontSize="9" fontWeight="800" fill="#052e16" fontFamily="sans-serif" letterSpacing="1">
        CABGO
      </text>

      {/* door handles + door seam */}
      <rect x="230" y="152" width="22" height="4" rx="2" fill="#dbeafe" opacity="0.9" />
      <rect x="318" y="152" width="22" height="4" rx="2" fill="#dbeafe" opacity="0.9" />
      <path d="M282 100v78" stroke="#1e3a8a" strokeOpacity="0.25" strokeWidth="2" />

      {/* lights */}
      <path d="M486 160c8 1 14 4 16 9v10h-20l4-19Z" fill="#fef08a" />
      <path d="M54 164c-1 5-2 11-2 16h18v-17l-16 1Z" fill="#ef4444" />
      <rect x="470" y="190" width="22" height="6" rx="3" fill="#0a0a0a" opacity="0.5" />

      {/* wheels */}
      {[132, 424].map((cx) => (
        <g key={cx}>
          <circle cx={cx} cy="202" r="35" fill="#0a0a0a" />
          <circle cx={cx} cy="202" r="22" fill="url(#cg-rim)" />
          <circle cx={cx} cy="202" r="8" fill="#374151" />
          {[0, 72, 144, 216, 288].map((deg) => (
            <rect
              key={deg}
              x={cx - 2}
              y="182"
              width="4"
              height="14"
              rx="2"
              fill="#9ca3af"
              transform={`rotate(${deg} ${cx} 202)`}
            />
          ))}
        </g>
      ))}
      {/* wheel arches */}
      <path d="M92 190a40 40 0 0 1 80 0" stroke="#1e3a8a" strokeOpacity="0.6" strokeWidth="4" fill="none" />
      <path d="M384 190a40 40 0 0 1 80 0" stroke="#1e3a8a" strokeOpacity="0.6" strokeWidth="4" fill="none" />
    </svg>
  );
}
