import { DownloadCloudIcon, SearchXIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AddMemeSheet } from "@/components/add-meme-sheet";
import { Pagination } from "@/components/pagination";
import { PostGrid } from "@/components/post-grid";
import { ScheduleForm } from "@/components/schedule-form";
import { ScrapeButton } from "@/components/scrape-button";
import { SearchInput } from "@/components/search-input";
import { MemesSkeleton } from "@/components/skeletons";
import { TabNav } from "@/components/tab-nav";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  countByStatus,
  countPosts,
  getIgAccount,
  getSettings,
  listPosts,
  PAGE_SIZE,
  type PostStatus,
} from "@/db/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getLogger } from "@/lib/log";

const log = getLogger("pages");
// Scrape now and image uploads run as server actions of this page
export const maxDuration = 60;

export const metadata = { title: "Memes" };

const TABS: { status: PostStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "approved", label: "Approved" },
  { status: "rejected", label: "Rejected" },
  { status: "posted", label: "Posted" },
];

const EMPTY: Record<PostStatus, { title: string; description: string }> = {
  new: {
    title: "No new memes to review",
    description: "Scrape your subreddits to fill the queue, or add a meme of your own.",
  },
  approved: {
    title: "Nothing approved yet",
    description: "Approve memes from the New tab and they’ll show up here, ready to schedule.",
  },
  rejected: {
    title: "No rejected memes",
    description: "Memes you reject are kept here for 14 days in case you change your mind.",
  },
  posted: {
    title: "Nothing posted yet",
    description: "Once a scheduled meme goes out on Instagram, it’s listed here.",
  },
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function parseStatus(value: string | string[] | undefined): PostStatus {
  return TABS.find((t) => t.status === first(value))?.status ?? "new";
}

function parsePage(value: string | string[] | undefined): number {
  const n = Number(first(value));
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

function hrefFor(status: PostStatus, q: string, page = 1) {
  const p = new URLSearchParams();
  if (status !== "new") p.set("status", status);
  if (q) p.set("q", q);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/?${qs}` : "/";
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await requireAdmin();
  const params = await searchParams;
  const status = parseStatus(params.status);
  const requestedPage = parsePage(params.page);
  const q = first(params.q).trim().slice(0, 100);

  let data;
  try {
    const [counts, settings, matching, account] = await Promise.all([
      countByStatus(),
      getSettings(),
      q ? countPosts(status, q) : Promise.resolve(null),
      // only the Approved tab shows previews, which need the Instagram handle
      status === "approved" ? getIgAccount() : Promise.resolve(null),
    ]);
    const total = matching ?? counts[status];
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(requestedPage, totalPages);
    data = {
      posts: await listPosts(status, page, q),
      counts,
      timezone: settings.timezone,
      username: account?.username ?? null,
      page,
      totalPages,
    };
  } catch (e) {
    log.error({ err: e }, "Dashboard data load failed");
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          title="We couldn’t load your memes"
          description="The database didn’t respond, so nothing was lost. Reload to try again. If it keeps happening, check the server logs."
        >
          <Link href={hrefFor(status, q)} className={buttonVariants({ variant: "outline" })}>
            Reload page
          </Link>
        </EmptyState>
      </div>
    );
  }

  const empty = data.posts.length === 0;
  return (
    <>
      <TabNav
        label="Meme status"
        items={TABS.map((t) => ({
          href: hrefFor(t.status, q),
          label: t.label,
          count: data.counts[t.status],
          active: t.status === status,
        }))}
      />
      <SearchInput placeholder="Search titles and authors" />
      {status === "approved" && !q && (
        <ScheduleForm unscheduledCount={data.posts.filter((p) => !p.scheduledAt).length} />
      )}
      {empty ? (
        <div className="rounded-xl border bg-card">
          {q ? (
            <EmptyState
              icon={SearchXIcon}
              title={`No ${TABS.find((t) => t.status === status)?.label.toLowerCase()} memes match “${q}”`}
              description="Try a different word, or search another tab."
            >
              <Link href={hrefFor(status, "")} className={buttonVariants({ variant: "outline" })}>
                Clear search
              </Link>
            </EmptyState>
          ) : (
            <EmptyState icon={status === "new" ? DownloadCloudIcon : undefined} {...EMPTY[status]} />
          )}
        </div>
      ) : (
        <PostGrid posts={data.posts} status={status} timezone={data.timezone} username={data.username} />
      )}
      <Pagination
        page={data.page}
        totalPages={data.totalPages}
        hrefFor={(p) => hrefFor(status, q, p)}
      />
    </>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <PageHeader
        title="Memes"
        description="Review what the scraper found. Approve the good ones and they’re scheduled for Instagram."
      >
        <AddMemeSheet />
        <ScrapeButton />
      </PageHeader>
      <Suspense fallback={<MemesSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}
