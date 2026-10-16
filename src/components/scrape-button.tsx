"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { scrapeNow, type ScrapeState } from "@/app/actions/posts";

export function ScrapeButton() {
  const [state, action, pending] = useActionState<ScrapeState>(
    async () => scrapeNow(),
    null,
  );
  return (
    <form action={action} className="flex items-center gap-3">
      <Button type="submit" disabled={pending}>
        {pending ? "Scraping…" : "Scrape now"}
      </Button>
      {state && (
        <p
          role="status"
          className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
