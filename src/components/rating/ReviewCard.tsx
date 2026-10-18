import { Stars } from '@/components/rating/Stars';
import { UserAvatar } from '@/components/shared/UserAvatar';
import { timeAgo } from '@/lib/utils';
import type { ReviewItem } from '@/types';

/** One written review (server-safe). */
export function ReviewCard({ review }: { review: ReviewItem }) {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <header className="flex items-center gap-3">
        <UserAvatar name={review.author?.full_name} src={review.author?.avatar_url} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{review.author?.full_name ?? 'Rider'}</p>
          <p className="text-xs text-muted-foreground">{timeAgo(review.created_at)}</p>
        </div>
        <Stars value={review.rating} />
      </header>
      {review.review_text && <p className="mt-3 text-sm leading-relaxed">{review.review_text}</p>}
      {review.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {review.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
