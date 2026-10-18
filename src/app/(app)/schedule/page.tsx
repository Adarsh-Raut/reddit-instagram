import { CalendarClockIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ScheduleRow, type ScheduleRowData } from "@/components/schedule-row";
import { SearchInput } from "@/components/search-input";
import { RowsSkeleton } from "@/components/skeletons";
import { TabNav } from "@/components/tab-nav";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getIgAccount, getSettings, listSchedule, type ScheduleItem } from "@/db/queries";
import { requireAdmin } from "@/lib/auth/session";
import { buildCaption } from "@/lib/instagram/caption";
import { previewImageUrl } from "@/lib/instagram/preview-url";
import { getLogger } from "@/lib/log";
import { sourceLabel } from "@/lib/memes/manual";
import { toLocalInputValue } from "@/lib/schedule/local-time";
import { dayKey, formatDayHeading, formatTime } from "@/lib/schedule/slots";

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

async function ScheduleList({ searchParams }: { searchParams: PageProps<"/schedule">["searchParams"] }) {
  await requireAdmin();
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.key === first(params.filter))?.key ?? "all";
  const q = first(params.q).trim().slice(0, 100);

  let items: ScheduleItem[], timezone: string, username: string | null;
  try {
    const [settings, account] = await Promise.all([getSettings(), getIgAccount()]);
    timezone = settings.timezone;
    username = account?.username ?? null;
    items = await listSchedule();
  } catch (e) {
    log.error({ err: e }, "Schedule load failed");
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          title="We couldn’t load the schedule"
          description="The database didn’t respond, so nothing was lost. Reload to try again. If it keeps happening, check the server logs."
        >
          <Link href={hrefFor(filter, q)} className={buttonVariants({ variant: "outline" })}>
            Reload page
          </Link>
        </EmptyState>
      </div>
    );
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

  const now = new Date();
  const days = new Map<string, { heading: string; rows: ScheduleRowData[] }>();
  for (const it of visible) {
    const k = dayKey(it.scheduledAt, timezone);
    const group = days.get(k) ?? { heading: formatDayHeading(it.scheduledAt, timezone, now), rows: [] };
    group.rows.push({
      id: it.id,
      title: it.post.title,
      source: sourceLabel(it.post),
      imageUrl: it.post.cloudinaryUrl,
      time: formatTime(it.scheduledAt, timezone),
      whenValue: toLocalInputValue(it.scheduledAt, timezone),
      status: it.status,
      error: it.error,
      caption: it.caption,
      defaultCaption: buildCaption(it.post),
      previewUrl: previewImageUrl(it.post.cloudinaryPublicId),
    });
    days.set(k, group);
  }

  return (
    <>
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
          <div className="md:overflow-x-auto">
            <table className="w-full text-left max-md:block md:min-w-[40rem]">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground max-md:hidden">
                <tr>
                  <th scope="col" className="py-2.5 pr-3 pl-4 font-medium">Meme</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Time</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                  <th scope="col" className="py-2.5 pr-4 pl-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              {[...days.entries()].map(([key, group]) => (
                <tbody key={key} className="divide-y border-b last:border-b-0 max-md:block">
                  <tr className="bg-muted/20 max-md:block">
                    <th scope="colgroup" colSpan={4} className="py-2 pr-3 pl-4 text-sm font-semibold">
                      {group.heading}
                    </th>
                  </tr>
                  {group.rows.map((row) => (
                    <ScheduleRow key={row.id} row={row} timezone={timezone} username={username} />
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {visible.length} {visible.length === 1 ? "post" : "posts"} · times shown in {timezone}.
      </p>
    </>
  );
}

export default function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  return (
    <>
      <PageHeader
        title="Schedule"
        description="Every post that’s queued, publishing, or recently sent. Failed posts wait here for you to retry."
      />
      <Suspense fallback={<RowsSkeleton label="Loading schedule" />}>
        <ScheduleList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
