import { CalendarClockIcon, ChevronLeftIcon, ChevronRightIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { monthHref, ScheduleCalendar, ViewToggle } from "@/components/schedule-calendar";
import { groupScheduleItems, ScheduleTable } from "@/components/schedule-table";
import { SearchInput } from "@/components/search-input";
import { RowsSkeleton } from "@/components/skeletons";
import { TabNav } from "@/components/tab-nav";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getIgAccount, getSettings, lastPendingAt, listSchedule, listScheduleBetween, type ScheduleItem } from "@/db/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getLogger } from "@/lib/log";
import {
  addDays,
  dayLabel,
  dayRange,
  gridRange,
  monthGrid,
  monthOfKey,
  monthParam,
  monthTitle,
  parseDayKey,
  parseMonth,
  shortDayLabel,
  summarizeDays,
} from "@/lib/schedule/calendar";
import { dayKey } from "@/lib/schedule/slots";

const log = getLogger("pages");
// Publish now runs as a server action of this page and can take ~30s
export const maxDuration = 60;

export const metadata = { title: "Schedule" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "posted", label: "Posted" },
  { key: "failed", label: "Failed" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

type SearchParams = PageProps<"/schedule">["searchParams"];
type Shared = { timezone: string; username: string | null; slotsPerDay: number };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function matches(it: ScheduleItem, filter: Filter) {
  if (filter === "upcoming") return it.status === "pending" || it.status === "publishing";
  if (filter === "posted") return it.status === "posted";
  if (filter === "failed") return it.status === "failed";
  return true;
}

function hrefFor(filter: Filter, q: string) {
  const p = new URLSearchParams();
  if (filter !== "all") p.set("filter", filter);
  if (q) p.set("q", q);
  const qs = p.toString();
  return qs ? `/schedule?${qs}` : "/schedule";
}

function LoadError({ href }: { href: string }) {
  return (
    <div className="rounded-xl border bg-card">
      <EmptyState
        title="We couldn’t load the schedule"
        description="The database didn’t respond, so nothing was lost. Reload to try again. If it keeps happening, check the server logs."
      >
        <Link href={href} className={buttonVariants({ variant: "outline" })}>
          Reload page
        </Link>
      </EmptyState>
    </div>
  );
}

async function ListView({ params, shared }: { params: Awaited<SearchParams>; shared: Shared }) {
  const { timezone, username } = shared;
  const filter = FILTERS.find((f) => f.key === first(params.filter))?.key ?? "all";
  const q = first(params.q).trim().slice(0, 100);

  let items: ScheduleItem[];
  try {
    items = await listSchedule();
  } catch (e) {
    log.error({ err: e }, "Schedule load failed");
    return <LoadError href={hrefFor(filter, q)} />;
  }

  const counts = {
    all: items.length,
    upcoming: items.filter((i) => matches(i, "upcoming")).length,
    posted: items.filter((i) => matches(i, "posted")).length,
    failed: items.filter((i) => matches(i, "failed")).length,
  };
  const needle = q.toLowerCase();
  const visible = items.filter(
    (i) => matches(i, filter) && (!needle || i.post.title.toLowerCase().includes(needle) || i.caption.toLowerCase().includes(needle)),
  );
  const groups = groupScheduleItems(visible, timezone, new Date());

  return (
    <>
      <div className="flex justify-end">
        <ViewToggle active="list" />
      </div>
      <TabNav
        label="Schedule status"
        items={FILTERS.map((f) => ({ href: hrefFor(f.key, q), label: f.label, count: counts[f.key], active: f.key === filter }))}
      />
      <SearchInput placeholder="Search by title or caption" />
      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        {visible.length === 0 ? (
          q ? (
            <EmptyState
              icon={SearchXIcon}
              title={`No scheduled posts match “${q}”`}
              description="Try a different word, or look under another filter."
            >
              <Link href={hrefFor(filter, "")} className={buttonVariants({ variant: "outline" })}>
                Clear search
              </Link>
            </EmptyState>
          ) : filter !== "all" ? (
            <EmptyState
              icon={CalendarClockIcon}
              title={`No ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} posts`}
              description="Posts appear here as they move through the schedule."
            >
              <Link href="/schedule" className={buttonVariants({ variant: "outline" })}>
                Show all posts
              </Link>
            </EmptyState>
          ) : (
            <EmptyState
              icon={CalendarClockIcon}
              title="Nothing scheduled yet"
              description="Approve memes, then schedule them from the Approved tab. Posts go out at your daily post times."
            >
              <Link href="/" className={buttonVariants()}>
                Review new memes
              </Link>
            </EmptyState>
          )
        ) : (
          <ScheduleTable groups={groups} timezone={timezone} username={username} />
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {visible.length} {visible.length === 1 ? "post" : "posts"} · times shown in {timezone}.
      </p>
    </>
  );
}

async function MonthView({ params, shared }: { params: Awaited<SearchParams>; shared: Shared }) {
  const { timezone, slotsPerDay } = shared;
  const todayKey = dayKey(new Date(), timezone);
  const month = parseMonth(first(params.month), todayKey);
  const grid = monthGrid(month);
  const { from, to } = gridRange(grid, timezone);

  let items: ScheduleItem[], lastPending: Date | null;
  try {
    [items, lastPending] = await Promise.all([listScheduleBetween(from, to), lastPendingAt()]);
  } catch (e) {
    log.error({ err: e }, "Calendar load failed");
    return <LoadError href={monthHref(month)} />;
  }

  const summaries = summarizeDays(items, timezone, {
    slotsPerDay,
    todayKey,
    lastPlannedKey: lastPending ? dayKey(lastPending, timezone) : null,
  });
  const itemsByDay = new Map<string, ScheduleItem[]>();
  for (const it of items) {
    const k = dayKey(it.scheduledAt, timezone);
    itemsByDay.set(k, [...(itemsByDay.get(k) ?? []), it]);
  }
  const total = items.filter((it) => dayKey(it.scheduledAt, timezone).startsWith(monthParam(month))).length;

  return (
    <ScheduleCalendar
      month={month}
      grid={grid}
      summaries={summaries}
      itemsByDay={itemsByDay}
      todayKey={todayKey}
      slotsPerDay={slotsPerDay}
      timezone={timezone}
      total={total}
    />
  );
}

async function DayView({ day, shared }: { day: string; shared: Shared }) {
  const { timezone, username } = shared;
  const month = monthOfKey(day);
  const { from, to } = dayRange(day, timezone);

  let items: ScheduleItem[];
  try {
    items = await listScheduleBetween(from, to);
  } catch (e) {
    log.error({ err: e }, "Day load failed");
    return <LoadError href={`/schedule?day=${day}`} />;
  }

  const btn = buttonVariants({ variant: "outline", size: "sm" });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={monthHref(month)} className={btn}>
            <ChevronLeftIcon data-icon="inline-start" />
            {monthTitle(month)}
          </Link>
          <Link href={`/schedule?day=${addDays(day, -1)}`} className={btn} aria-label={`Previous day, ${dayLabel(addDays(day, -1))}`}>
            <ChevronLeftIcon data-icon="inline-start" />
            {shortDayLabel(addDays(day, -1))}
          </Link>
          <Link href={`/schedule?day=${addDays(day, 1)}`} className={btn} aria-label={`Next day, ${dayLabel(addDays(day, 1))}`}>
            {shortDayLabel(addDays(day, 1))}
            <ChevronRightIcon data-icon="inline-end" />
          </Link>
        </div>
        <ViewToggle active="month" month={month} />
      </div>
      <h2 className="text-lg font-semibold">
        {dayLabel(day)}
        <span className="ml-2 text-sm font-normal text-muted-foreground">
          {items.length} {items.length === 1 ? "post" : "posts"} · times shown in {timezone}
        </span>
      </h2>
      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        {items.length === 0 ? (
          <EmptyState
            icon={CalendarClockIcon}
            title={`Nothing scheduled for ${dayLabel(day)}`}
            description="Approve memes and schedule them from the Approved tab to fill this day."
          >
            <Link href={monthHref(month)} className={buttonVariants({ variant: "outline" })}>
              Back to {monthTitle(month)}
            </Link>
          </EmptyState>
        ) : (
          <ScheduleTable groups={groupScheduleItems(items, timezone, new Date())} timezone={timezone} username={username} />
        )}
      </div>
    </>
  );
}

async function ScheduleContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const params = await searchParams;

  let shared: Shared;
  try {
    const [settings, account] = await Promise.all([getSettings(), getIgAccount()]);
    shared = { timezone: settings.timezone, username: account?.username ?? null, slotsPerDay: settings.postSlots.length };
  } catch (e) {
    log.error({ err: e }, "Schedule settings load failed");
    return <LoadError href="/schedule" />;
  }

  const day = parseDayKey(first(params.day));
  if (day) return <DayView day={day} shared={shared} />;
  if (first(params.view) === "month") return <MonthView params={params} shared={shared} />;
  return <ListView params={params} shared={shared} />;
}

export default function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  return (
    <>
      <PageHeader
        title="Schedule"
        description="Every post that’s queued, publishing, or sent. Switch to the month view to spot gaps, and failed posts wait here for you to retry."
      />
      <Suspense fallback={<RowsSkeleton label="Loading schedule" />}>
        <ScheduleContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
