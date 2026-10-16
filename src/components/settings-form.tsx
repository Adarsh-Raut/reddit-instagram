"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsState } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import type { AppSettings } from "@/db/queries";

const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateSettings, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Subreddits</span>
        <input name="subreddits" defaultValue={settings.subreddits.join(", ")} className={field} />
        <span className="text-xs text-muted-foreground">Comma separated, e.g. memes, dankmemes</span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Memes per scrape</span>
        <input type="number" name="scrapeCount" min={1} max={50} defaultValue={settings.scrapeCount} className={field} />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Daily post times (24h)</span>
        <input name="postSlots" defaultValue={settings.postSlots.join(", ")} className={field} />
        <span className="text-xs text-muted-foreground">e.g. 09:00, 14:00, 20:00. Use at least 3 for 3 posts a day.</span>
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Timezone</span>
        <input name="timezone" defaultValue={settings.timezone} className={field} />
        <span className="text-xs text-muted-foreground">IANA name, e.g. Asia/Kolkata or America/New_York</span>
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
        {state && (
          <p role="status" className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
