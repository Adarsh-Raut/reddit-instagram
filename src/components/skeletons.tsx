import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";

function TabsSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-6 border-b pb-3">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-5 w-20" />
      ))}
    </div>
  );
}

/** Same geometry as the meme grid: tabs, search, then three columns of image cards. */
export function MemesSkeleton() {
  return (
    <SkeletonRegion label="Loading memes" className="space-y-6">
      <TabsSkeleton count={4} />
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border bg-card">
            <Skeleton className="aspect-square rounded-none" />
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

/** Rows in a framed list: thumbnail, two text lines, and a status/actions block. */
export function RowsSkeleton({ label, rows = 6 }: { label: string; rows?: number }) {
  return (
    <SkeletonRegion label={label} className="space-y-4">
      <Skeleton className="h-10 w-full max-w-sm" />
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <Skeleton className="size-14 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

export function SettingsSkeleton() {
  return (
    <SkeletonRegion label="Loading settings" className="space-y-6">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="space-y-4 rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </SkeletonRegion>
  );
}
