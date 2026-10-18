import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = { href: string; label: string; count?: number; active: boolean };

/** Section tabs as links, so each view has its own URL. Scrolls sideways instead of wrapping. */
export function TabNav({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <ul className="flex min-w-max gap-0.5 border-b md:gap-1">
        {items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "-mb-px flex min-h-10 items-center gap-1.5 border-b-2 px-2.5 text-sm md:gap-2 md:px-3 font-medium whitespace-nowrap transition-colors duration-150 ease-out motion-reduce:transition-none max-md:min-h-11",
                t.active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn("text-xs tabular-nums", t.active ? "text-primary" : "text-muted-foreground")}>
                  {t.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
