import { PostBoard, type BoardItem } from "@/components/post-board";
import type { PostStatus, PostWithSchedule } from "@/db/queries";
import { buildCaption, pickCaption } from "@/lib/instagram/caption";
import { previewImageUrl } from "@/lib/instagram/preview-url";
import { isManual, sourceLabel } from "@/lib/memes/manual";
import { formatInTimezone } from "@/lib/schedule/slots";

/**
 * Prepares everything server-side (timezone formatting, the exact Instagram image URL, the final
 * caption) and hands plain data to the interactive board.
 */
export function PostGrid({
  posts,
  status,
  timezone,
  username,
}: {
  posts: PostWithSchedule[];
  status: PostStatus;
  timezone: string;
  /** Instagram handle shown in the preview; null when not connected. */
  username: string | null;
}) {
  const items: BoardItem[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    source: sourceLabel(p),
    author: p.author,
    permalink: isManual(p) ? null : p.permalink,
    imageUrl: p.cloudinaryUrl || null,
    status: p.status,
    scheduledLabel: p.status === "approved" && p.scheduledAt ? formatInTimezone(p.scheduledAt, timezone) : null,
    postedLabel: p.status === "posted" && p.scheduledAt ? formatInTimezone(p.scheduledAt, timezone) : null,
    // only approved memes show a preview, and only they need the extra work
    previewUrl: p.status === "approved" ? previewImageUrl(p.cloudinaryPublicId) : null,
    previewCaption: p.status === "approved" ? pickCaption(p.scheduleCaption ?? "", buildCaption(p)) : "",
  }));
  return <PostBoard items={items} status={status} username={username} />;
}
