import Image from "next/image";
import { Suspense } from "react";
import { unschedulePost } from "@/app/actions/schedule";
import { requireAdmin } from "@/lib/auth/session";
import { getLogger } from "@/lib/log";
import { EditScheduleForm } from "@/components/edit-schedule-form";
import { PublishButton } from "@/components/publish-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettings, listSchedule } from "@/db/queries";
import { buildCaption } from "@/lib/instagram/api";
import { sourceLabel } from "@/lib/memes/manual";
import { toLocalInputValue } from "@/lib/schedule/local-time";
import { dayKey, formatInTimezone } from "@/lib/schedule/slots";

const log = getLogger("pages");
const STATUS_VARIANT = {
  pending: "secondary",
  publishing: "default",
  posted: "outline",
  failed: "destructive",
} as const;

async function ScheduleList() {
  await requireAdmin();
  let items, timezone;
  try {
    const settings = await getSettings();
    timezone = settings.timezone;
    items = await listSchedule();
  } catch (e) {
    log.error({ err: e }, "Schedule load failed");
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load the schedule</CardTitle>
          <CardDescription>Check DATABASE_URL and that the migration has been applied.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Nothing scheduled. Approve memes on the dashboard, then schedule them from the Approved tab.
      </p>
    );
  }

  const days = new Map<string, typeof items>();
  for (const it of items) {
    const k = dayKey(it.scheduledAt, timezone);
    days.set(k, [...(days.get(k) ?? []), it]);
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Times shown in {timezone}.</p>
      {[...days.entries()].map(([day, list]) => (
        <section key={day} className="space-y-2">
          <h2 className="text-sm font-medium">{day}</h2>
          <ul className="space-y-2">
            {list.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-2">
                <div className="relative size-16 shrink-0 overflow-hidden rounded bg-muted">
                  {it.post.cloudinaryUrl && (
                    <Image src={it.post.cloudinaryUrl} alt={it.post.title} fill sizes="64px" className="object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{it.post.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatInTimezone(it.scheduledAt, timezone)} · {sourceLabel(it.post)}
                  </p>
                  {it.error && <p className="truncate text-xs text-destructive">{it.error}</p>}
                </div>
                <Badge variant={STATUS_VARIANT[it.status]}>{it.status}</Badge>
                {(it.status === "pending" || it.status === "failed") && (
                  <PublishButton id={it.id} retry={it.status === "failed"} />
                )}
                {it.status === "pending" && (
                  <form action={unschedulePost}>
                    <input type="hidden" name="id" value={it.id} />
                    <Button type="submit" size="sm" variant="outline">Unschedule</Button>
                  </form>
                )}
                {(it.status === "pending" || it.status === "failed") && (
                  <EditScheduleForm
                    id={it.id}
                    caption={it.caption}
                    defaultCaption={buildCaption(it.post)}
                    whenValue={toLocalInputValue(it.scheduledAt, timezone)}
                    timezone={timezone}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Schedule</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <ScheduleList />
      </Suspense>
    </main>
  );
}
