"use client";

import { CircleAlertIcon, ImageOffIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { analyzeCaption, CAPTION_MAX_LENGTH, type CaptionIssue } from "@/lib/instagram/caption";
import { cn } from "@/lib/utils";

const MIN_RATIO = 4 / 5;
const MAX_RATIO = 1.91;

function aspectLabel(w: number, h: number) {
  const r = w / h;
  return Math.abs(r - MIN_RATIO) < 0.01 ? "4:5" : `${r.toFixed(2)}:1`;
}

/**
 * Shows the exact image URL and caption text that publishing sends, laid out like a feed post.
 * It is a check, not a screenshot: the Instagram app may render it slightly differently.
 */
export function InstagramPreview({
  imageUrl,
  caption,
  username,
}: {
  /** The transformed image Instagram will fetch. Null when it can't be built. */
  imageUrl: string | null;
  /** The final caption (edited, or the default). */
  caption: string;
  username: string | null;
}) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const analysis = analyzeCaption(caption);
  const name = username ?? "your_account";

  const issues: CaptionIssue[] = [...analysis.issues];
  if (!imageUrl || imageFailed) {
    issues.unshift({ level: "error", text: "The image can’t be loaded, so Instagram won’t be able to fetch it either. Check the Cloudinary settings and that the image still exists." });
  } else if (size && (size.w / size.h < MIN_RATIO - 0.005 || size.w / size.h > MAX_RATIO + 0.005)) {
    issues.unshift({ level: "error", text: `Instagram only accepts 4:5 to 1.91:1 images. This one is ${aspectLabel(size.w, size.h)}.` });
  }

  const cut = analysis.feedCut && !expanded ? analysis.feedCut.shown : null;

  return (
    <div className="space-y-4">
      {issues.length > 0 && (
        <ul role="alert" className="space-y-2">
          {issues.map((i) => (
            <li
              key={i.text}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                i.level === "error" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-warning/30 bg-warning/10 text-warning",
              )}
            >
              {i.level === "error" ? <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
              {i.text}
            </li>
          ))}
        </ul>
      )}

      <figure className="overflow-hidden rounded-xl border bg-card shadow-soft">
        <figcaption className="flex items-center gap-2.5 px-3 py-2.5">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-sm font-medium uppercase text-muted-foreground">
            {name[0]}
          </span>
          <span className="truncate text-sm font-medium">{name}</span>
        </figcaption>
        <div className="border-y bg-muted">
          {imageUrl && !imageFailed ? (
            // A plain <img> on purpose: next/image would re-encode it, and this must be the exact file Instagram fetches.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={imageUrl}
              src={imageUrl}
              alt="The image Instagram will receive"
              className="block w-full"
              onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <ImageOffIcon className="size-5" aria-hidden />
              Image unavailable
            </div>
          )}
        </div>
        <p className="px-3 py-3 text-sm leading-relaxed break-words whitespace-pre-line">
          <span className="font-medium">{name}</span>{" "}
          {cut !== null ? (
            <>
              {cut}
              <span className="text-muted-foreground">… </span>
              <button type="button" onClick={() => setExpanded(true)} className="text-muted-foreground hover:text-foreground hover:underline max-md:py-2">
                more
              </button>
            </>
          ) : (
            <>
              {caption}
              {analysis.feedCut && (
                <>
                  {" "}
                  <button type="button" onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground hover:underline max-md:py-2">
                    less
                  </button>
                </>
              )}
            </>
          )}
        </p>
      </figure>

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Image</dt>
          <dd className="text-right tabular-nums">
            {imageFailed || !imageUrl ? "Unavailable" : size ? `${size.w} × ${size.h} px · JPEG · ${aspectLabel(size.w, size.h)}` : "Loading…"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Caption</dt>
          <dd className="text-right tabular-nums">
            {analysis.length.toLocaleString("en-US")} / {CAPTION_MAX_LENGTH.toLocaleString("en-US")} characters · {analysis.hashtags} {analysis.hashtags === 1 ? "hashtag" : "hashtags"}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">
        This is the exact image and caption we send to Instagram. The app may show it a little differently, and long captions are cut after about 125 characters in the feed.
      </p>
    </div>
  );
}
