import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
