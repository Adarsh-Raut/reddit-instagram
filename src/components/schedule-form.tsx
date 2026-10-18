"use client";

import { CalendarPlusIcon, LoaderCircleIcon } from "lucide-react";
import { useActionState } from "react";
import { scheduleApproved, type ActionState } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useActionToast } from "@/lib/use-action-toast";

/** Shown on the Approved tab: spread every unscheduled approved meme across the next N days. */
export function ScheduleForm({ unscheduledCount }: { unscheduledCount: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(scheduleApproved, null);
  useActionToast(state);
  const none = unscheduledCount === 0;
  return (
    <form
      action={action}
      className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-xl border bg-card p-4 shadow-soft"
    >
      <div className="min-w-48 flex-1 space-y-1">
        <h2 className="text-base font-semibold">Schedule approved memes</h2>
        <p className="text-sm text-muted-foreground">
          {none
            ? "Every approved meme on this page already has a time."
            : `${unscheduledCount} approved ${unscheduledCount === 1 ? "meme needs" : "memes need"} a time. They’re spread across your daily post times.`}
        </p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="schedule-days" className="block text-sm font-medium">
          Days to fill
        </label>
        <Input id="schedule-days" type="number" name="days" defaultValue={7} min={1} max={90} className="w-24" />
      </div>
      <Button type="submit" disabled={pending || none} aria-busy={pending}>
        {pending ? (
          <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
        ) : (
          <CalendarPlusIcon data-icon="inline-start" />
        )}
        {pending ? "Scheduling…" : `Schedule ${unscheduledCount} ${unscheduledCount === 1 ? "meme" : "memes"}`}
      </Button>
    </form>
  );
}
