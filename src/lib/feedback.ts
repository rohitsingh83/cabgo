import type { TicketCategory, TicketStatus } from '@/types';

/* ---------------------------------------------------------------------- */
/* Ratings                                                                 */
/* ---------------------------------------------------------------------- */

export type RatingTarget = 'driver' | 'rider';

/** Headline shown under the stars while the user picks a score. */
export const RATING_LABELS: Record<number, string> = {
  1: 'Terrible',
  2: 'Not good',
  3: 'It was okay',
  4: 'Good ride',
  5: 'Excellent!',
};

/** Quick-pick tags. Positive ones appear for 4–5 stars, negative for 1–2, both for 3. */
export const RATING_TAGS = {
  driver: {
    positive: ['Safe driving', 'Clean car', 'Friendly', 'On time', 'Great navigation', 'Smooth ride'],
    negative: ['Unsafe driving', 'Dirty car', 'Rude', 'Late', 'Wrong route', 'Overcharged'],
  },
  rider: {
    positive: ['Polite', 'On time', 'Respectful', 'Clear directions'],
    negative: ['Rude', 'Kept me waiting', 'Messy', 'Unsafe behaviour'],
  },
} as const satisfies Record<RatingTarget, { positive: readonly string[]; negative: readonly string[] }>;

export function tagsFor(target: RatingTarget, stars: number): readonly string[] {
  const { positive, negative } = RATING_TAGS[target];
  if (stars >= 4) return positive;
  if (stars >= 1 && stars <= 2) return negative;
  return [...positive.slice(0, 3), ...negative.slice(0, 3)];
}

/** Every tag a user may attach for a given direction (used for server-side validation). */
export function allowedTags(target: RatingTarget): ReadonlySet<string> {
  const { positive, negative } = RATING_TAGS[target];
  return new Set<string>([...positive, ...negative]);
}

/* ---------------------------------------------------------------------- */
/* Support                                                                 */
/* ---------------------------------------------------------------------- */

export const TICKET_CATEGORIES: { value: TicketCategory; label: string; hint: string }[] = [
  { value: 'payment_issue', label: 'Payment issue', hint: 'Overcharged, failed payment, refund' },
  { value: 'driver_behavior', label: 'Driver behaviour', hint: 'Rude, unsafe or unprofessional' },
  { value: 'lost_item', label: 'Lost item', hint: 'Left something in the car' },
  { value: 'app_bug', label: 'App problem', hint: 'Something is broken or confusing' },
  { value: 'other', label: 'Something else', hint: 'Anything not covered above' },
];

export const TICKET_CATEGORY_LABEL: Record<TicketCategory, string> = Object.fromEntries(
  TICKET_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<TicketCategory, string>;

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

/** A user may have this many unresolved tickets at once (stops spam, keeps the queue useful). */
export const MAX_OPEN_TICKETS = 10;

/* ---------------------------------------------------------------------- */
/* Safety                                                                  */
/* ---------------------------------------------------------------------- */

/** India's single emergency number (police, fire, ambulance). */
export const EMERGENCY_NUMBER = '112';
/** Rides in these states can trigger SOS. */
export const SOS_RIDE_STATUSES = ['accepted', 'driver_arriving', 'in_progress'] as const;
/** Seconds the rider has to cancel an accidental SOS before it is sent. */
export const SOS_COUNTDOWN_SECONDS = 5;
