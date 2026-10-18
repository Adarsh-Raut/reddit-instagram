import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A zero state that says what belongs here, why it matters, and offers one next step.
 * Always rendered inside the page's framed region so the layout doesn't jump.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col items-center px-6 py-16 text-center", className)}>
      {Icon && <Icon className="mb-4 size-6 text-muted-foreground" aria-hidden />}
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </section>
  );
}
