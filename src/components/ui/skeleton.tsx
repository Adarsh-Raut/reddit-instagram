import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("skeleton", className)} {...props} />;
}

/** Wrap a whole loading layout in this so nothing flashes for loads faster than 100ms. */
export function SkeletonRegion({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn("skeleton-region", className)}>
      {children}
    </div>
  );
}
