import Image from "next/image";
import { reviewPost } from "@/app/actions/posts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { PostStatus, ScrapedPost } from "@/db/queries";

const EMPTY: Record<PostStatus, string> = {
  new: "No new memes. Hit “Scrape now” to fetch some.",
  approved: "Nothing approved yet.",
  rejected: "Nothing rejected.",
  posted: "Nothing posted yet.",
};

function ReviewButton({ id, status, label, variant }: {
  id: string;
  status: "new" | "approved" | "rejected";
  label: string;
  variant?: "default" | "outline" | "destructive";
}) {
  return (
    <form action={reviewPost}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" size="sm" variant={variant}>
        {label}
      </Button>
    </form>
  );
}

export function PostGrid({ posts, status }: { posts: ScrapedPost[]; status: PostStatus }) {
  if (posts.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{EMPTY[status]}</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <li key={p.id}>
          <Card className="h-full overflow-hidden pt-0">
            <div className="relative aspect-square bg-muted">
              <Image
                src={p.cloudinaryUrl}
                alt={p.title}
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-contain"
              />
            </div>
            <CardContent className="space-y-2">
              <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">r/{p.subreddit}</Badge>
                {p.author && <span>u/{p.author}</span>}
                <a href={p.permalink} target="_blank" rel="noreferrer" className="underline">
                  source
                </a>
              </div>
            </CardContent>
            <CardFooter className="mt-auto gap-2">
              {p.status === "new" && (
                <>
                  <ReviewButton id={p.id} status="approved" label="Approve" />
                  <ReviewButton id={p.id} status="rejected" label="Reject" variant="outline" />
                </>
              )}
              {(p.status === "approved" || p.status === "rejected") && (
                <ReviewButton id={p.id} status="new" label="Move back to new" variant="outline" />
              )}
            </CardFooter>
          </Card>
        </li>
      ))}
    </ul>
  );
}
