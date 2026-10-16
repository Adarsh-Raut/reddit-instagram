import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const link = "rounded-md border px-3 py-1 text-sm hover:bg-muted";
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={link}>
          ← Previous
        </Link>
      ) : (
        <span className={`${link} pointer-events-none opacity-40`}>← Previous</span>
      )}
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={link}>
          Next →
        </Link>
      ) : (
        <span className={`${link} pointer-events-none opacity-40`}>Next →</span>
      )}
    </nav>
  );
}
