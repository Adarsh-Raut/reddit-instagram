"use client";

import { DownloadCloudIcon, LoaderCircleIcon } from "lucide-react";
import { useActionState } from "react";
import { scrapeNow, type ScrapeState } from "@/app/actions/posts";
import { Button } from "@/components/ui/button";
import { useActionToast } from "@/lib/use-action-toast";

export function ScrapeButton() {
  const [state, action, pending] = useActionState<ScrapeState>(async () => scrapeNow(), null);
  useActionToast(state);
  return (
    <form action={action}>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? (
          <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
        ) : (
          <DownloadCloudIcon data-icon="inline-start" />
        )}
        {pending ? "Scraping…" : "Scrape now"}
      </Button>
    </form>
  );
}
