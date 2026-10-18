import { ClockIcon, ExternalLinkIcon, ImageOffIcon } from "lucide-react";
import Image from "next/image";
import { ReviewActions } from "@/components/review-actions";
import type { PostStatus, PostWithSchedule } from "@/db/queries";
import { isManual, sourceLabel } from "@/lib/memes/manual";
import { formatInTimezone } from "@/lib/schedule/slots";

/** Media-first grid: the image leads, the decision buttons sit at the bottom of each card. */
export function PostGrid({
  posts,
  timezone,
}: {
  posts: PostWithSchedule[];
  status: PostStatus;
  timezone: string;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <li key={p.id}>
          <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-soft">
            <div className="relative aspect-square border-b bg-muted">
              {p.cloudinaryUrl ? (
                <Image
                  src={p.cloudinaryUrl}
                  alt={p.title}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <ImageOffIcon className="size-5" aria-hidden />
                  Image removed to save space
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div className="space-y-1.5">
                <h3 className="line-clamp-2 text-sm leading-snug font-medium">{p.title}</h3>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{sourceLabel(p)}</span>
                  {p.author && <span>by u/{p.author}</span>}
                  {!isManual(p) && (
                    <a
                      href={p.permalink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      View on Reddit
                      <ExternalLinkIcon className="size-3" aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  )}
                </p>
              </div>
              {p.status === "approved" && (
                <p className="flex items-center gap-1.5 text-sm">
                  <ClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {p.scheduledAt ? (
                    <span>
                      <span className="text-muted-foreground">Posts </span>
                      {formatInTimezone(p.scheduledAt, timezone)}
                    </span>
                  ) : (
                    <span className="text-warning">Not scheduled yet</span>
                  )}
                </p>
              )}
              {p.status === "posted" && p.scheduledAt && (
                <p className="text-sm text-muted-foreground">Posted {formatInTimezone(p.scheduledAt, timezone)}</p>
              )}
              <div className="mt-auto pt-1">
                <ReviewActions id={p.id} status={p.status} title={p.title} />
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
