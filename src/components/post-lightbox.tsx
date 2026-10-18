"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ImageOffIcon, RotateCcwIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import type { BoardItem } from "@/components/post-board";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { IconButton } from "@/components/ui/tooltip";
import type { Review } from "@/lib/use-review";

/** Full-size view of one meme with the review actions, so you can judge it without leaving the keyboard. */
export function PostLightbox({
  item,
  index,
  total,
  busy,
  onClose,
  onMove,
  onReview,
}: {
  item: BoardItem;
  index: number;
  total: number;
  busy: boolean;
  onClose: () => void;
  onMove: (delta: number) => void;
  onReview: (next: Review) => void;
}) {
  // focus the dialog itself, not the Close button: its tooltip would swallow the first Esc press
  const popupRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/70 transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup
          ref={popupRef}
          initialFocus={popupRef}
          tabIndex={-1}
          data-lightbox
          className="fixed inset-2 z-50 flex flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-soft outline-none transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none md:inset-8"
        >
          <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold">{item.title}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                {item.source}
                {item.author ? ` · by u/${item.author}` : ""} · {index + 1} of {total}
              </Dialog.Description>
            </div>
            <Dialog.Close render={<IconButton label="Close" shortcut="Esc" size="icon-sm" />}>
              <XIcon />
            </Dialog.Close>
          </header>

          <div className="relative min-h-0 flex-1 bg-muted">
            {item.imageUrl ? (
              <Image
                key={item.id}
                src={item.imageUrl}
                alt={item.title}
                fill
                sizes="100vw"
                loading="eager"
                className="object-contain"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <ImageOffIcon className="size-5" aria-hidden />
                Image removed to save space
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
            <div className="flex items-center gap-1">
              <IconButton label="Previous meme" shortcut="←" variant="outline" onClick={() => onMove(-1)} disabled={index === 0}>
                <ChevronLeftIcon />
              </IconButton>
              <IconButton label="Next meme" shortcut="→" variant="outline" onClick={() => onMove(1)} disabled={index >= total - 1}>
                <ChevronRightIcon />
              </IconButton>
            </div>
            <div className="flex items-center gap-2">
              {item.status === "new" ? (
                <>
                  <Button variant="outline" onClick={() => onReview("rejected")} disabled={busy}>
                    <XIcon data-icon="inline-start" />
                    Reject
                    <Kbd className="ml-1 max-md:hidden">R</Kbd>
                  </Button>
                  <Button onClick={() => onReview("approved")} disabled={busy}>
                    <CheckIcon data-icon="inline-start" />
                    Approve
                    <Kbd className="ml-1 max-md:hidden border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">A</Kbd>
                  </Button>
                </>
              ) : item.status === "approved" || item.status === "rejected" ? (
                <Button variant="outline" onClick={() => onReview("new")} disabled={busy}>
                  <RotateCcwIcon data-icon="inline-start" />
                  {item.status === "approved" ? "Move back to New" : "Restore to New"}
                  <Kbd className="ml-1 max-md:hidden">B</Kbd>
                </Button>
              ) : null}
            </div>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
