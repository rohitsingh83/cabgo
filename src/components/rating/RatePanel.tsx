'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Send } from 'lucide-react';

import { StarRating } from '@/components/rating/StarRating';
import { Stars } from '@/components/rating/Stars';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { ApiClientError, apiFetch } from '@/lib/api-client';
import { RATING_LABELS, tagsFor, type RatingTarget } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { createRatingSchema } from '@/lib/validations';
import type { Rating } from '@/types';

interface RatePanelProps {
  rideId: string;
  /** Who is being rated: riders rate the `driver`, drivers rate the `rider`. */
  target: RatingTarget;
  /** First name shown in the copy ("How was your ride with Ravi?"). */
  name: string;
  existing: Rating | null;
  className?: string;
}

const MAX_REVIEW = 1000;

/**
 * Post-trip rating card: stars → quick tags → optional written review. Once submitted (or when a rating
 * already exists) it collapses into a read-only summary. Ratings are final, so there is no edit mode.
 */
export function RatePanel({ rideId, target, name, existing, className }: RatePanelProps) {
  const [saved, setSaved] = useState<Rating | null>(existing);
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = name.split(' ')[0] ?? name;
  const options = stars > 0 ? tagsFor(target, stars) : [];

  const pickStars = (value: number) => {
    setStars(value);
    // Keep only tags that are still offered for the new score (e.g. switching from 5★ to 2★).
    setTags((prev) => prev.filter((tag) => tagsFor(target, value).includes(tag)));
    setError(null);
  };

  const toggleTag = (tag: string) => setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length >= 6 ? prev : [...prev, tag]));

  const submit = async () => {
    const parsed = createRatingSchema.safeParse({ rideId, rating: stars, reviewText: review, tags });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your rating and try again.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const rating = await apiFetch<Rating>('/api/ratings', { method: 'POST', body: parsed.data });
      setSaved(rating);
      toast({ variant: 'success', title: 'Thanks for the feedback', description: `Your rating helps keep CabGo great.` });
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        // Already rated from another device/tab — treat as done instead of showing an error.
        toast({ title: 'Already rated', description: err.message });
      }
      setError(err instanceof ApiClientError ? err.message : 'Could not send your rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label="Rating" className={cn('rounded-2xl border border-border bg-card p-5', className)}>
      <AnimatePresence mode="wait" initial={false}>
        {saved ? (
          <motion.div key="done" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-extrabold">You rated {firstName}</p>
                <div className="mt-1">
                  <Stars value={saved.rating} className="h-5 w-5" />
                </div>
                {saved.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {saved.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {saved.review_text && <p className="mt-3 text-sm text-muted-foreground">&ldquo;{saved.review_text}&rdquo;</p>}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="text-center">
              <h2 className="font-display text-lg font-extrabold">{target === 'driver' ? `How was your ride with ${firstName}?` : `How was ${firstName}?`}</h2>
              <p className="text-sm text-muted-foreground">{target === 'driver' ? 'Your feedback helps drivers improve.' : 'Your feedback helps keep the community respectful.'}</p>
            </div>

            <StarRating value={stars} onChange={pickStars} disabled={submitting} label={target === 'driver' ? 'Rate your driver' : 'Rate your rider'} />
            <p className="h-5 text-center text-sm font-semibold" aria-live="polite">
              {stars > 0 ? RATING_LABELS[stars] : ''}
            </p>

            <AnimatePresence initial={false}>
              {stars > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-4 overflow-hidden">
                  <div role="group" aria-label="Quick tags" className="flex flex-wrap justify-center gap-2">
                    {options.map((tag) => {
                      const on = tags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleTag(tag)}
                          disabled={submitting}
                          className={cn(
                            'min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            on ? 'border-brand bg-brand text-white' : 'border-border bg-background hover:border-brand/60',
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <label htmlFor={`review-${rideId}`} className="sr-only">
                      Written review (optional)
                    </label>
                    <Textarea
                      id={`review-${rideId}`}
                      value={review}
                      onChange={(event) => setReview(event.target.value.slice(0, MAX_REVIEW))}
                      placeholder="Add a comment (optional)"
                      rows={3}
                      disabled={submitting}
                      className="resize-none"
                    />
                    <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                      {review.length}/{MAX_REVIEW}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button variant="brand" size="lg" className="h-12 w-full" onClick={() => void submit()} disabled={submitting || stars === 0}>
              {submitting ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
              {submitting ? 'Sending…' : 'Submit rating'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
