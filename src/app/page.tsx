import Link from "next/link";
import { Suspense } from "react";
import { PostGrid } from "@/components/post-grid";
import { ScrapeButton } from "@/components/scrape-button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleForm } from "@/components/schedule-form";
import { countByStatus, getSettings, listPosts, type PostStatus } from "@/db/queries";

const TABS: { status: PostStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
  { status: "posted", label: "Posted" },
];

function parseStatus(value: string | string[] | undefined): PostStatus {
  const v = Array.isArray(value) ? value[0] : value;
  return TABS.find((t) => t.status === v)?.status ?? "new";
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const status = parseStatus((await searchParams).status);

  let data;
  try {
    const [posts, counts, settings] = await Promise.all([
      listPosts(status),
      countByStatus(),
      getSettings(),
    ]);
    data = { posts, counts, timezone: settings.timezone };
  } catch (e) {
    console.error("Dashboard data load failed", e);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load posts</CardTitle>
          <CardDescription>
            Check that DATABASE_URL is set in .env.local and the migration has been
            applied (npm run db:push).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <nav className="flex gap-2 border-b" aria-label="Post status">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={t.status === "new" ? "/" : `/?status=${t.status}`}
            aria-current={t.status === status ? "page" : undefined}
            className={
              t.status === status
                ? "border-b-2 border-foreground px-3 py-2 text-sm font-medium"
                : "px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {t.label} ({data.counts[t.status]})
          </Link>
        ))}
      </nav>
      {status === "approved" && (
        <ScheduleForm unscheduledCount={data.posts.filter((p) => !p.scheduledAt).length} />
      )}
      <PostGrid posts={data.posts} status={status} timezone={data.timezone} />
    </>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Memes</h1>
        <ScrapeButton />
      </header>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
