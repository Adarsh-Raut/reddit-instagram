import { CircleAlertIcon, CircleCheckIcon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Pagination } from "@/components/pagination";
import { RowsSkeleton } from "@/components/skeletons";
import { TabNav } from "@/components/tab-nav";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ACTIVITY_PAGE_SIZE, countActivity, getSettings, listActivity } from "@/db/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getLogger } from "@/lib/log";
import { formatInTimezone } from "@/lib/schedule/slots";
import { cn } from "@/lib/utils";

const log = getLogger("pages");

export const metadata = { title: "Activity" };

const LEVELS = {
  info: { icon: CircleCheckIcon, label: "Info", tone: "text-muted-foreground", bar: "bg-border" },
  warn: { icon: TriangleAlertIcon, label: "Warning", tone: "text-warning", bar: "bg-warning" },
  error: { icon: OctagonXIcon, label: "Error", tone: "text-destructive", bar: "bg-destructive" },
} as const;

function hrefFor(onlyProblems: boolean, page = 1) {
  const q = new URLSearchParams();
  if (onlyProblems) q.set("filter", "problems");
  if (page > 1) q.set("page", String(page));
  const qs = q.toString();
  return qs ? `/activity?${qs}` : "/activity";
}

async function ActivityList({ searchParams }: { searchParams: PageProps<"/activity">["searchParams"] }) {
  await requireAdmin();
  const params = await searchParams;
  const onlyProblems = params.filter === "problems";
  const n = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const requestedPage = Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;

  let data;
  try {
    const [total, settings] = await Promise.all([countActivity(onlyProblems), getSettings()]);
    const totalPages = Math.max(1, Math.ceil(total / ACTIVITY_PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    data = { rows: await listActivity(page, onlyProblems), timezone: settings.timezone, page, totalPages };
  } catch (e) {
    log.error({ err: e }, "Activity load failed");
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          title="We couldn’t load the activity log"
          description="The database didn’t respond, so nothing was lost. Reload to try again. If it keeps happening, check the server logs."
        >
          <Link href={hrefFor(onlyProblems)} className={buttonVariants({ variant: "outline" })}>
            Reload page
          </Link>
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <TabNav
        label="Activity filter"
        items={[
          { href: hrefFor(false), label: "All activity", active: !onlyProblems },
          { href: hrefFor(true), label: "Warnings and errors", active: onlyProblems },
        ]}
      />
      <div className="overflow-hidden rounded-xl border bg-card shadow-soft">
        {data.rows.length === 0 ? (
          onlyProblems ? (
            <EmptyState
              icon={CircleCheckIcon}
              title="No warnings or errors"
              description="Everything that has run recently finished without problems."
            >
              <Link href="/activity" className={buttonVariants({ variant: "outline" })}>
                Show all activity
              </Link>
            </EmptyState>
          ) : (
            <EmptyState
              icon={CircleAlertIcon}
              title="Nothing has happened yet"
              description="Scrapes, posts, sign-ins and errors will be listed here as they happen."
            />
          )
        ) : (
          <ol className="divide-y">
            {data.rows.map((r) => {
              const level = LEVELS[r.level as keyof typeof LEVELS] ?? LEVELS.info;
              const Icon = level.icon;
              return (
                <li key={r.id} className="relative flex gap-3 py-3 pr-4 pl-5">
                  <span className={cn("absolute inset-y-0 left-0 w-1", level.bar)} aria-hidden />
                  <Icon className={cn("mt-0.5 size-4 shrink-0", level.tone)} aria-hidden />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm">
                      <span className="sr-only">{level.label}: </span>
                      {r.message}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <time dateTime={r.at.toISOString()}>{formatInTimezone(r.at, data.timezone)}</time>
                      <code className="font-mono">{r.kind}</code>
                    </p>
                    {r.meta != null && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="inline-flex min-h-6 cursor-pointer items-center hover:text-foreground max-md:min-h-11">
                          Show details
                        </summary>
                        <pre className="mt-1 overflow-x-auto rounded-md bg-muted p-3 font-mono">{JSON.stringify(r.meta, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(p) => hrefFor(onlyProblems, p)} />
    </>
  );
}

export default function ActivityPage({ searchParams }: PageProps<"/activity">) {
  return (
    <>
      <PageHeader
        title="Activity"
        description="Everything the app has done: scrapes, posts, sign-ins and errors. Entries are kept for 90 days."
      />
      <Suspense fallback={<RowsSkeleton label="Loading activity" rows={8} />}>
        <ActivityList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
