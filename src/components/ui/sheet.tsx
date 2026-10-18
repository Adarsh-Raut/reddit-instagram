"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { IconButton } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/**
 * Slide-over panel for short edits (<10s). Enters from the trailing edge, full width on narrow
 * screens. Focus is trapped while open and returns to the trigger on close.
 */
export function SheetContent({
  title,
  description,
  side = "right",
  className,
  children,
}: {
  title: string;
  description?: string;
  side?: "right" | "left";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
      <DialogPrimitive.Popup
        className={cn(
          "fixed inset-y-0 z-50 flex w-full flex-col border-border bg-popover text-popover-foreground shadow-soft outline-none transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none md:max-w-md",
          side === "right"
            ? "right-0 border-l data-[ending-style]:translate-x-6 data-[starting-style]:translate-x-6"
            : "left-0 border-r data-[ending-style]:-translate-x-6 data-[starting-style]:-translate-x-6",
          "data-[ending-style]:opacity-0 data-[starting-style]:opacity-0",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0 space-y-1">
            <DialogPrimitive.Title className="text-lg font-semibold leading-tight">{title}</DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close render={<IconButton label="Close panel" shortcut="Esc" size="icon-sm" />}>
            <XIcon />
          </DialogPrimitive.Close>
        </header>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}
