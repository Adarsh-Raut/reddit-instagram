import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { PostGrid } from "@/components/post-grid";
import { ScrapeButton } from "@/components/scrape-button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScheduleForm } from "@/components/schedule-form";
import { Pagination } from "@/components/pagination";
import { countByStatus, getSettings, listPosts, PAGE_SIZE, type PostStatus } from "@/db/queries";

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

function parsePage(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await requireAdmin();
  const params = await searchParams;
  const status = parseStatus(params.status);
  const requestedPage = parsePage(params.page);

  let data;
  try {
    const [counts, settings] = await Promise.all([countByStatus(), getSettings()]);
    const totalPages = Math.max(1, Math.ceil(counts[status] / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    data = { posts: await listPosts(status, page), counts, timezone: settings.timezone, page, totalPages };
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
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        hrefFor={(p) => {
          const q = new URLSearchParams();
          if (status !== "new") q.set("status", status);
          if (p > 1) q.set("page", String(p));
          const qs = q.toString();
          return qs ? `/?${qs}` : "/";
        }}
      />
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
