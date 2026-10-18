import { cn } from "@/lib/utils";

/** Title, one sentence of context, and the page's primary actions on the trailing side. */
export function PageHeader({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl leading-tight font-semibold">{title}</h1>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}
