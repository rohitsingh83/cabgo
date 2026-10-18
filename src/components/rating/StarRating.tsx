'use client';

import { useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Accessible name for the group, e.g. "Rate your driver". */
  label: string;
}

/**
 * Interactive 1–5 star picker implemented as a radio group (arrow keys move the selection, Home/End jump).
 * Every star is a 48 px touch target; the stars up to the selected one fill in.
 */
export function StarRating({ value, onChange, disabled, label }: StarRatingProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (target: number) => {
    const next = Math.min(5, Math.max(1, target));
    onChange(next);
    refs.current[next - 1]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      move((value || 0) + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      move((value || 2) - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      move(1);
    } else if (event.key === 'End') {
      event.preventDefault();
      move(5);
    }
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKeyDown} className="flex items-center justify-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <button
            key={star}
            ref={(node) => {
              refs.current[star - 1] = node;
            }}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            // Roving tabindex: only the selected star (or the first, when nothing is chosen) is a tab stop.
            tabIndex={value === star || (value === 0 && star === 1) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(star)}
            className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-60"
          >
            <motion.span animate={{ scale: active ? 1 : 0.9 }} whileTap={{ scale: 1.2 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
              <Star className={cn('h-9 w-9 transition-colors', active ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} aria-hidden />
            </motion.span>
          </button>
        );
      })}
    </div>
  );
}
