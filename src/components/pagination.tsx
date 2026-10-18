import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Always renders, even for one page, so the layout doesn't change as data grows. */
export function Pagination({
  page,
  totalPages,
  hrefFor,
  className,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  className?: string;
}) {
  const btn = buttonVariants({ variant: "outline", size: "sm" });
  const disabled = "pointer-events-none opacity-50";
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-3", className)}>
      <p className="text-sm text-muted-foreground tabular-nums">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={btn} rel="prev">
            <ChevronLeftIcon data-icon="inline-start" />
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(btn, disabled)}>
            <ChevronLeftIcon data-icon="inline-start" />
            Previous
          </span>
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className={btn} rel="next">
            Next
            <ChevronRightIcon data-icon="inline-end" />
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(btn, disabled)}>
            Next
            <ChevronRightIcon data-icon="inline-end" />
          </span>
        )}
      </div>
    </nav>
  );
}
