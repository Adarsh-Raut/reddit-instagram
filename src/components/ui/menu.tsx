"use client";

import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

export const Menu = MenuPrimitive.Root;
export const MenuTrigger = MenuPrimitive.Trigger;

export function MenuContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner align="end" sideOffset={6} className="z-50">
        <MenuPrimitive.Popup
          className={cn(
            "min-w-44 origin-(--transform-origin) rounded-lg border bg-popover p-1 text-sm text-popover-foreground shadow-soft outline-none transition-[transform,opacity] duration-150 ease-out data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0 motion-reduce:transition-none",
            className,
          )}
        >
          {children}
        </MenuPrimitive.Popup>
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  );
}

export function MenuItem({
  className,
  destructive,
  ...props
}: MenuPrimitive.Item.Props & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-muted max-md:min-h-11 [&_svg]:size-4 [&_svg]:shrink-0",
        destructive ? "text-destructive" : "text-foreground",
        className,
      )}
      {...props}
    />
  );
}
