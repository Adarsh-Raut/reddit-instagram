"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-colors duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/40 data-[checked]:bg-primary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60 motion-reduce:transition-none max-md:my-1",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow-soft transition-transform duration-150 ease-out data-[checked]:translate-x-[1.125rem] motion-reduce:transition-none" />
    </SwitchPrimitive.Root>
  );
}
