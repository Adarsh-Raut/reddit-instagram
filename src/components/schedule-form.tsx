"use client";

import { useActionState } from "react";
import { scheduleApproved, type ActionState } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";

export function ScheduleForm({ unscheduledCount }: { unscheduledCount: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(scheduleApproved, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <label className="flex items-center gap-2 text-sm">
        Fill the next
        <input
          type="number"
          name="days"
          defaultValue={7}
          min={1}
          max={90}
          className="w-16 rounded-md border bg-background px-2 py-1"
        />
        days
      </label>
      <Button type="submit" disabled={pending || unscheduledCount === 0}>
        {pending ? "Scheduling…" : `Schedule ${unscheduledCount} approved`}
      </Button>
      {state && (
        <p role="status" className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
