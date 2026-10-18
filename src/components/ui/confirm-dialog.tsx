"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { useRef, type ReactElement } from "react";
import { Button } from "@/components/ui/button";

/**
 * Confirmation that names the exact thing being acted on. Cancel has initial focus, Escape
 * dismisses, and the confirm button uses the action's verb ("Publish now", "Disconnect").
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  trigger: ReactElement<Record<string, unknown>>;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialogPrimitive.Root>
      <AlertDialogPrimitive.Trigger render={trigger} />
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <AlertDialogPrimitive.Popup
          initialFocus={cancelRef}
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-popover p-5 text-popover-foreground shadow-soft outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none"
        >
          <div className="space-y-2">
            <AlertDialogPrimitive.Title className="text-lg font-semibold leading-tight">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm text-muted-foreground">
              {description}
            </AlertDialogPrimitive.Description>
          </div>
          <div className="flex justify-end gap-2">
            <AlertDialogPrimitive.Close render={<Button ref={cancelRef} variant="outline" />}>
              Cancel
            </AlertDialogPrimitive.Close>
            <AlertDialogPrimitive.Close
              render={<Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} />}
            >
              {confirmLabel}
            </AlertDialogPrimitive.Close>
          </div>
        </AlertDialogPrimitive.Popup>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
