import { CompassIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-xl border bg-card px-6 py-12 text-center shadow-soft">
        <CompassIcon className="mx-auto mb-4 size-6 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">We can’t find that page</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          The link may be out of date, or the page may have moved. Head back to your memes to pick up where you left off.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/" className={buttonVariants()}>
            Go to Memes
          </Link>
          <Link href="/schedule" className={buttonVariants({ variant: "outline" })}>
            View schedule
          </Link>
        </div>
      </section>
    </main>
  );
}
