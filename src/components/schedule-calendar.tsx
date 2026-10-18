import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, ListIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { ScheduleItem } from "@/db/queries";
import {
  dayLabel,
  monthParam,
  monthTitle,
  shiftMonth,
  WEEKDAYS,
  type DaySummary,
  type GridDay,
  type Month,
} from "@/lib/schedule/calendar";
import { cn } from "@/lib/utils";

export const monthHref = (m: Month) => `/schedule?view=month&month=${monthParam(m)}`;

/** List | Month switch. The two views show the same posts. */
export function ViewToggle({ active, month }: { active: "list" | "month"; month?: Month }) {
  const item = (view: "list" | "month", label: string, href: string, Icon: typeof ListIcon) => (
    <Link
      href={href}
      aria-current={active === view ? "page" : undefined}
      className={cn(
        "flex min-h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out motion-reduce:transition-none max-md:min-h-10",
        active === view ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </Link>
  );
  return (
    <div role="group" aria-label="Schedule view" className="inline-flex rounded-lg border bg-card p-0.5 shadow-soft">
      {item("list", "List", "/schedule", ListIcon)}
      {item("month", "Month", month ? monthHref(month) : "/schedule?view=month", CalendarDaysIcon)}
    </div>
  );
}

const DOT: Record<ScheduleItem["status"], string> = {
  pending: "bg-muted-foreground/60",
  publishing: "bg-primary",
  posted: "bg-success",
  failed: "bg-destructive",
};
const RING: Record<ScheduleItem["status"], string> = {
  pending: "border-border",
  publishing: "border-primary",
  posted: "border-success",
  failed: "border-destructive",
};

/**
 * Month grid in the schedule's timezone. Each day links to that day's posts. Days that are planned
 * but have fewer posts than daily post times are marked, so gaps are visible at a glance.
 */
export function ScheduleCalendar({
  month,
  grid,
  summaries,
  itemsByDay,
  todayKey,
  slotsPerDay,
  timezone,
  total,
}: {
  month: Month;
  grid: GridDay[][];
  summaries: Map<string, DaySummary>;
  itemsByDay: Map<string, ScheduleItem[]>;
  todayKey: string;
  slotsPerDay: number;
  timezone: string;
  total: number;
}) {
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const title = monthTitle(month);
  const btn = buttonVariants({ variant: "outline", size: "sm" });
  const short = (m: Month) => monthTitle(m).split(" ")[0].slice(0, 3);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={monthHref(prev)} className={btn} aria-label={`Previous month, ${monthTitle(prev)}`}>
            <ChevronLeftIcon data-icon="inline-start" />
            {short(prev)}
          </Link>
          <h2 className="min-w-36 text-center text-lg font-semibold">{title}</h2>
          <Link href={monthHref(next)} className={btn} aria-label={`Next month, ${monthTitle(next)}`}>
            {short(next)}
            <ChevronRightIcon data-icon="inline-end" />
          </Link>
          <Link href="/schedule?view=month" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Today
          </Link>
        </div>
        <ViewToggle active="month" month={month} />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{title}, times in {timezone}</caption>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" className="border-b py-2 text-xs font-medium text-muted-foreground">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => (
              <tr key={row[0].key}>
                {row.map((cell) => {
                  const s = summaries.get(cell.key);
                  const items = itemsByDay.get(cell.key) ?? [];
                  const isToday = cell.key === todayKey;
                  const planned = s ? s.count - s.failed : 0;
                  const label = `${dayLabel(cell.key)}: ${s?.count ? `${s.count} ${s.count === 1 ? "post" : "posts"}` : "no posts"}${s?.short ? `, fewer than ${slotsPerDay} planned` : ""}`;
                  return (
                    <td
                      key={cell.key}
                      className={cn(
                        "h-16 border-r p-0 align-top last:border-r-0 lg:h-28",
                        ri < grid.length - 1 && "border-b",
                        !cell.inMonth && "bg-muted/30",
                      )}
                    >
                      <Link
                        href={`/schedule?day=${cell.key}`}
                        aria-label={label}
                        className="flex h-full flex-col gap-1 p-1.5 outline-offset-[-2px] transition-colors duration-150 ease-out hover:bg-muted/60 motion-reduce:transition-none lg:p-2"
                      >
                        <span className="flex items-start justify-between gap-1">
                          <span
                            className={cn(
                              "grid size-6 place-items-center rounded-full text-sm tabular-nums",
                              isToday ? "bg-primary font-medium text-primary-foreground" : cell.inMonth ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {cell.day}
                          </span>
                          {s?.short ? (
                            <span className="text-xs font-medium text-warning tabular-nums">
                              {planned}
                              <span className="max-lg:sr-only"> of {slotsPerDay}</span>
                              <span className="sr-only"> of {slotsPerDay} planned</span>
                            </span>
                          ) : s?.count ? (
                            <span className="text-xs text-muted-foreground tabular-nums">{s.count}</span>
                          ) : null}
                        </span>
                        {/* large screens: small thumbnails ringed by status (two on laptops, three on wide screens) */}
                        {items.length > 0 && (
                          <span className="hidden min-w-0 items-center gap-1 overflow-hidden lg:flex">
                            {items.slice(0, 3).map((it, i) => (
                              <span
                                key={it.id}
                                className={cn("relative size-8 shrink-0 overflow-hidden rounded-md border-2 bg-muted", RING[it.status], i === 2 && "max-xl:hidden")}
                              >
                                {it.post.cloudinaryUrl && <Image src={it.post.cloudinaryUrl} alt="" fill sizes="32px" className="object-cover" />}
                              </span>
                            ))}
                            {items.length > 2 && <span className="text-xs text-muted-foreground xl:hidden">+{items.length - 2}</span>}
                            {items.length > 3 && <span className="text-xs text-muted-foreground max-xl:hidden">+{items.length - 3}</span>}
                          </span>
                        )}
                        {/* smaller screens: one dot per post, coloured by status */}
                        {items.length > 0 && (
                          <span className="flex flex-wrap gap-1 lg:hidden" aria-hidden>
                            {items.slice(0, 6).map((it) => (
                              <span key={it.id} className={cn("size-2 rounded-full", DOT[it.status])} />
                            ))}
                          </span>
                        )}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing is scheduled in {title}. Approve memes and schedule them from the Approved tab, and they’ll appear here.
        </p>
      )}

      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        {(
          [
            ["Scheduled", "pending"],
            ["Posted", "posted"],
            ["Failed", "failed"],
          ] as const
        ).map(([text, status]) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden />
            {text}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="font-medium text-warning">2 of {slotsPerDay}</span>
          fewer posts than daily post times
        </li>
        <li>Times shown in {timezone}.</li>
      </ul>
    </div>
  );
}
