import type { Metadata } from 'next';
import { MessageSquareText, Star } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { Badge } from '@/components/ui/badge';
import { requireDriverWithProfile } from '@/lib/drivers/guard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { timeAgo } from '@/lib/utils';

export const metadata: Metadata = { title: 'Ratings' };
export const dynamic = 'force-dynamic';

function Stars({ value, className = 'h-4 w-4' }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`${className} ${i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} aria-hidden />
      ))}
    </span>
  );
}

export default async function DriverRatingsPage() {
  const { user, profile } = await requireDriverWithProfile();
  const db = createSupabaseAdminClient();

  // All scores feed the distribution + tag cloud; only the latest 30 reviews are listed.
  const [allResult, latestResult] = await Promise.all([
    db.from('ratings').select('rating, tags').eq('to_user_id', user.id).limit(2000),
    db.from('ratings').select('*').eq('to_user_id', user.id).order('created_at', { ascending: false }).limit(30),
  ]);
  if (allResult.error) throw new Error(`Failed to load ratings: ${allResult.error.message}`);
  if (latestResult.error) throw new Error(`Failed to load reviews: ${latestResult.error.message}`);

  const all = allResult.data ?? [];
  const latest = latestResult.data ?? [];

  const distribution = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: all.filter((r) => r.rating === stars).length }));
  const total = all.length;

  const tagCounts = new Map<string, number>();
  all.forEach((r) => r.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)));
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const authorIds = Array.from(new Set(latest.map((r) => r.from_user_id)));
  const { data: authors, error: authorsError } = authorIds.length
    ? await db.from('users').select('id, full_name, avatar_url').in('id', authorIds)
    : { data: [], error: null };
  if (authorsError) throw new Error(`Failed to load reviewers: ${authorsError.message}`);
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <PageHeader title="Ratings" description="What riders say about your trips." className="mb-0" />

      {total === 0 ? (
        <EmptyState icon={Star} title="No ratings yet" description="Riders can rate you after each completed trip. Your first reviews will show up here." />
      ) : (
        <>
          <section className="grid gap-6 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[200px_1fr] sm:p-6" aria-label="Summary">
            <div className="flex flex-col items-center justify-center text-center">
              <p className="font-display text-6xl font-extrabold tabular-nums">{Number(profile.average_rating).toFixed(2)}</p>
              <Stars value={Number(profile.average_rating)} className="mt-2 h-5 w-5" />
              <p className="mt-2 text-sm text-muted-foreground">
                {profile.rating_count.toLocaleString('en-IN')} rating{profile.rating_count === 1 ? '' : 's'}
              </p>
            </div>
            <ul className="space-y-2.5" aria-label="Rating distribution">
              {distribution.map(({ stars, count }) => (
                <li key={stars} className="flex items-center gap-3 text-sm">
                  <span className="flex w-8 items-center gap-1 font-semibold tabular-nums">
                    {stars}
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-gradient-to-r from-success to-brand" style={{ width: `${(count / total) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums text-muted-foreground">{count}</span>
                </li>
              ))}
            </ul>
          </section>

          {topTags.length > 0 && (
            <section aria-labelledby="tags-heading">
              <h2 id="tags-heading" className="mb-3 font-display text-lg font-extrabold">
                What riders appreciate
              </h2>
              <div className="flex flex-wrap gap-2">
                {topTags.map(([tag, count]) => (
                  <Badge key={tag} variant="info" className="px-3 py-1.5 text-sm">
                    {tag} · {count}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="reviews-heading">
            <h2 id="reviews-heading" className="mb-3 font-display text-lg font-extrabold">
              Latest reviews
            </h2>
            <ul className="space-y-3">
              {latest.map((review) => {
                const author = authorById.get(review.from_user_id);
                return (
                  <li key={review.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={author?.full_name} src={author?.avatar_url} className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{author?.full_name ?? 'Rider'}</p>
                        <p className="text-xs text-muted-foreground">{timeAgo(review.created_at)}</p>
                      </div>
                      <Stars value={review.rating} />
                    </div>
                    {review.review_text ? (
                      <p className="mt-3 text-sm">{review.review_text}</p>
                    ) : (
                      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MessageSquareText className="h-3.5 w-3.5" aria-hidden /> No written review
                      </p>
                    )}
                    {review.tags.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {review.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
