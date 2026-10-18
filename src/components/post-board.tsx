"use client";

import { CheckIcon, ClockIcon, ExternalLinkIcon, ImageOffIcon, LoaderCircleIcon, MaximizeIcon, RotateCcwIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PostLightbox } from "@/components/post-lightbox";
import { PostPreviewSheet } from "@/components/post-preview-sheet";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { PostStatus } from "@/db/queries";
import { clampIndex, moveIndex, pruneSelection, rangeIds, toggleId } from "@/lib/review-selection";
import { useReview, type Review } from "@/lib/use-review";
import { cn } from "@/lib/utils";

/** Everything a card shows, already formatted on the server (timezone, caption, preview URL). */
export type BoardItem = {
  id: string;
  title: string;
  source: string;
  author: string | null;
  /** Reddit link; null for memes you uploaded yourself. */
  permalink: string | null;
  imageUrl: string | null;
  status: PostStatus;
  /** Formatted schedule time for approved memes, null when not scheduled yet. */
  scheduledLabel: string | null;
  /** Formatted publish time for posted memes. */
  postedLabel: string | null;
  previewUrl: string | null;
  previewCaption: string;
};

type Action = "approve" | "reject" | "back";

function targetFor(action: Action): Review {
  return action === "approve" ? "approved" : action === "reject" ? "rejected" : "new";
}

/** Which actions make sense on which tab. */
function allowed(status: PostStatus, action: Action) {
  if (status === "new") return action !== "back";
  if (status === "approved" || status === "rejected") return action === "back";
  return false;
}

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

export function PostBoard({ items, status, username }: { items: BoardItem[]; status: PostStatus; username: string | null }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(-1);
  const [keyboardMode, setKeyboardMode] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const lastToggled = useRef<string | null>(null);
  const { review, busy, actingIds } = useReview(status as Review);

  const ids = items.map((i) => i.id);
  const selectedIds = [...pruneSelection(selected, ids)];
  const lightboxOpen = lightbox && items.length > 0;
  const cur = keyboardMode || lightboxOpen ? clampIndex(cursor, items.length) : -1;
  const reviewable = status === "new" || status === "approved" || status === "rejected";

  function act(action: Action, targetIds: string[]) {
    if (!allowed(status, action) || targetIds.length === 0 || busy) return;
    review(
      items.filter((i) => targetIds.includes(i.id)).map((i) => ({ id: i.id, title: i.title })),
      targetFor(action),
    );
    setSelected(new Set());
  }

  // keyboard shortcuts: J/K or arrows move, A/R/B review, X selects, V opens the big view
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      // a preview panel, confirmation or other dialog owns the keyboard while it is open
      if (document.querySelector('[role="dialog"]:not([data-lightbox]), [role="alertdialog"]')) return;
      if (items.length === 0) return;
      const key = e.key.toLowerCase();
      const move = (delta: number) => {
        e.preventDefault();
        setKeyboardMode(true);
        setCursor(moveIndex(cur, delta, items.length));
      };
      const targets = selectedIds.length > 0 ? selectedIds : cur >= 0 ? [items[cur].id] : [];

      if (key === "j" || key === "arrowright") move(1);
      else if (key === "k" || key === "arrowleft") move(-1);
      else if (key === "a" && reviewable) act("approve", targets);
      else if (key === "r" && reviewable) act("reject", targets);
      else if (key === "b" && reviewable) act("back", targets);
      else if (key === "x" && cur >= 0 && reviewable) {
        setSelected(toggleId(new Set(selectedIds), items[cur].id));
        lastToggled.current = items[cur].id;
      } else if (key === "v" && cur >= 0 && !lightboxOpen) setLightbox(true);
      else if (key === "escape" && !lightboxOpen) {
        if (selectedIds.length > 0) setSelected(new Set());
        else setKeyboardMode(false);
      }
    }
    // capture phase: dialogs stop arrow keys from bubbling, so a normal listener never sees them
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  // keep the card under the cursor in view
  useEffect(() => {
    if (cur < 0 || lightboxOpen) return;
    document.querySelector(`[data-post-id="${items[cur]?.id}"]`)?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [cur, items, lightboxOpen]);

  function toggle(id: string, shift: boolean) {
    if (shift && lastToggled.current) {
      const range = rangeIds(ids, lastToggled.current, id);
      setSelected(new Set([...selectedIds, ...range]));
    } else {
      setSelected(toggleId(new Set(selectedIds), id));
    }
    lastToggled.current = id;
  }

  return (
    <div className="space-y-4">
      {reviewable && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground max-md:hidden [@media(hover:none)]:hidden">
          <span className="flex items-center gap-1">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd> move
          </span>
          {status === "new" ? (
            <>
              <span className="flex items-center gap-1">
                <Kbd>A</Kbd> approve
              </span>
              <span className="flex items-center gap-1">
                <Kbd>R</Kbd> reject
              </span>
            </>
          ) : (
            <span className="flex items-center gap-1">
              <Kbd>B</Kbd> move back to New
            </span>
          )}
          <span className="flex items-center gap-1">
            <Kbd>X</Kbd> select
          </span>
          <span className="flex items-center gap-1">
            <Kbd>V</Kbd> view larger
          </span>
        </p>
      )}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => {
          const isCursor = index === cur && !lightboxOpen;
          const isSelected = selectedIds.includes(item.id);
          const acting = actingIds.has(item.id);
          return (
            <li key={item.id}>
              <article
                data-post-id={item.id}
                aria-current={isCursor ? "true" : undefined}
                onPointerDown={() => setKeyboardMode(false)}
                className={cn(
                  "group/card flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-soft transition-[box-shadow,opacity] duration-150 ease-out motion-reduce:transition-none",
                  isCursor && "ring-2 ring-primary",
                  isSelected && "border-primary",
                  acting && "opacity-50",
                )}
              >
                <div className="relative aspect-square border-b bg-muted">
                  {item.imageUrl ? (
                    <>
                      <Image
                        src={item.imageUrl}
                        alt={item.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        // the first row is above the fold: load it right away instead of waiting for lazy-load
                        loading={index < 3 ? "eager" : "lazy"}
                        fetchPriority={index < 3 ? "high" : "auto"}
                        className="object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCursor(index);
                          setLightbox(true);
                        }}
                        className="absolute inset-0 cursor-zoom-in outline-offset-[-3px]"
                      >
                        <span className="sr-only">View “{item.title}” larger</span>
                        <MaximizeIcon
                          aria-hidden
                          className="absolute right-2 bottom-2 size-7 rounded-md bg-background/85 p-1.5 text-foreground opacity-0 shadow-soft transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100 [@media(hover:none)]:opacity-100"
                        />
                      </button>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                      <ImageOffIcon className="size-5" aria-hidden />
                      Image removed to save space
                    </div>
                  )}
                  {reviewable && (
                    <label
                      className={cn(
                        "absolute top-2 left-2 grid size-9 cursor-pointer place-items-center rounded-md bg-background/85 shadow-soft transition-opacity duration-150 max-md:size-11",
                        isSelected ? "opacity-100" : "opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 [@media(hover:none)]:opacity-100",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        onClick={(e) => toggle(item.id, e.shiftKey)}
                        className="size-4 cursor-pointer accent-[var(--primary)]"
                      />
                      <span className="sr-only">Select “{item.title}”</span>
                    </label>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="space-y-1.5">
                    <h3 className="line-clamp-2 text-sm leading-snug font-medium">{item.title}</h3>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{item.source}</span>
                      {item.author && <span>by u/{item.author}</span>}
                      {item.permalink && (
                        <a
                          href={item.permalink}
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
                  {item.status === "approved" && (
                    <div className="flex flex-wrap items-center justify-between gap-x-2">
                      <p className="flex items-center gap-1.5 text-sm">
                        <ClockIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        {item.scheduledLabel ? (
                          <span>
                            <span className="text-muted-foreground">Posts </span>
                            {item.scheduledLabel}
                          </span>
                        ) : (
                          <span className="text-warning">Not scheduled yet</span>
                        )}
                      </p>
                      <PostPreviewSheet title={item.title} imageUrl={item.previewUrl} caption={item.previewCaption} username={username} />
                    </div>
                  )}
                  {item.status === "posted" && item.postedLabel && (
                    <p className="text-sm text-muted-foreground">Posted {item.postedLabel}</p>
                  )}
                  <div className="mt-auto pt-1">
                    {item.status === "new" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => act("approve", [item.id])} disabled={busy} aria-busy={acting}>
                          {acting ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : <CheckIcon data-icon="inline-start" />}
                          Approve
                        </Button>
                        <Button variant="outline" onClick={() => act("reject", [item.id])} disabled={busy}>
                          <XIcon data-icon="inline-start" />
                          Reject
                        </Button>
                      </div>
                    ) : item.status === "approved" || item.status === "rejected" ? (
                      <Button variant="outline" className="w-full" onClick={() => act("back", [item.id])} disabled={busy} aria-busy={acting}>
                        {acting ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : <RotateCcwIcon data-icon="inline-start" />}
                        {item.status === "approved" ? "Move back to New" : "Restore to New"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-2 rounded-xl border bg-popover p-2 text-popover-foreground shadow-soft"
        >
          <span className="px-2 text-sm font-medium tabular-nums" aria-live="polite">
            {selectedIds.length} selected
          </span>
          {status === "new" ? (
            <>
              <Button onClick={() => act("approve", selectedIds)} disabled={busy}>
                <CheckIcon data-icon="inline-start" />
                Approve {selectedIds.length}
              </Button>
              <Button variant="outline" onClick={() => act("reject", selectedIds)} disabled={busy}>
                <XIcon data-icon="inline-start" />
                Reject {selectedIds.length}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => act("back", selectedIds)} disabled={busy}>
              <RotateCcwIcon data-icon="inline-start" />
              Move {selectedIds.length} back to New
            </Button>
          )}
          {selectedIds.length < items.length && (
            <Button variant="ghost" onClick={() => setSelected(new Set(ids))}>
              Select all {items.length}
            </Button>
          )}
          <Button variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {lightboxOpen && cur >= 0 && (
        <PostLightbox
          item={items[cur]}
          index={cur}
          total={items.length}
          busy={busy}
          onClose={() => setLightbox(false)}
          onMove={(delta) => setCursor(moveIndex(cur, delta, items.length))}
          onReview={(next) => act(next === "approved" ? "approve" : next === "rejected" ? "reject" : "back", [items[cur].id])}
        />
      )}
    </div>
  );
}
