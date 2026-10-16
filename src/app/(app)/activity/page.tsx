import Link from "next/link";
import { Suspense } from "react";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVITY_PAGE_SIZE, countActivity, getSettings, listActivity } from "@/db/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getLogger } from "@/lib/log";
import { formatInTimezone } from "@/lib/schedule/slots";

const log = getLogger("pages");

const LEVEL_VARIANT = { info: "secondary", warn: "outline", error: "destructive" } as const;

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
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load the activity log</CardTitle>
          <CardDescription>Check DATABASE_URL and that the migration has been applied.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const tab = (active: boolean) =>
    active
      ? "border-b-2 border-foreground px-3 py-2 text-sm font-medium"
      : "px-3 py-2 text-sm text-muted-foreground hover:text-foreground";

  return (
    <>
      <nav className="flex gap-2 border-b" aria-label="Filter">
        <Link href="/activity" className={tab(!onlyProblems)}>
          All
        </Link>
        <Link href="/activity?filter=problems" className={tab(onlyProblems)}>
          Warnings and errors
        </Link>
      </nav>
      {data.rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {onlyProblems ? "No warnings or errors. All good." : "Nothing has happened yet."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.rows.map((r) => (
            <li key={r.id} className="space-y-1 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={LEVEL_VARIANT[r.level as keyof typeof LEVEL_VARIANT] ?? "secondary"}>{r.level}</Badge>
                <span className="text-xs text-muted-foreground">{formatInTimezone(r.at, data.timezone)}</span>
                <code className="text-xs text-muted-foreground">{r.kind}</code>
              </div>
              <p>{r.message}</p>
              {r.meta != null && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Details</summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-muted p-2">{JSON.stringify(r.meta, null, 2)}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        hrefFor={(p) => {
          const q = new URLSearchParams();
          if (onlyProblems) q.set("filter", "problems");
          if (p > 1) q.set("page", String(p));
          const qs = q.toString();
          return qs ? `/activity?${qs}` : "/activity";
        }}
      />
    </>
  );
}

export default function ActivityPage({ searchParams }: PageProps<"/activity">) {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Activity</h1>
      <p className="text-sm text-muted-foreground">
        What the app has done: posts, scrapes, logins and errors. Entries are kept for 90 days.
      </p>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ActivityList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
