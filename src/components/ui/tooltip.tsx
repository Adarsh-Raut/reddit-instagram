"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import type { ComponentProps, ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delay={300}>{children}</TooltipPrimitive.Provider>;
}

function TooltipBubble({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner sideOffset={6} className="z-50">
        <TooltipPrimitive.Popup className="flex items-center gap-2 rounded-md border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground shadow-soft transition-opacity duration-150 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none">
          {label}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

/** Wraps any single element with a real tooltip (hover and keyboard focus). */
export function WithTooltip({
  label,
  shortcut,
  children,
}: {
  label: string;
  shortcut?: string;
  children: ReactElement<Record<string, unknown>>;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger render={children} />
      <TooltipBubble label={label} shortcut={shortcut} />
    </TooltipPrimitive.Root>
  );
}

/** Square icon-only button. The label is both the accessible name and the tooltip. */
export function IconButton({
  label,
  shortcut,
  size = "icon",
  variant = "ghost",
  ...props
}: Omit<ComponentProps<typeof Button>, "aria-label"> & { label: string; shortcut?: string }) {
  return (
    <WithTooltip label={label} shortcut={shortcut}>
      <Button size={size} variant={variant} aria-label={label} {...props} />
    </WithTooltip>
  );
}
