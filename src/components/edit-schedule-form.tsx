"use client";

import { useActionState } from "react";
import { editScheduledPost, type ActionState } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";

export function EditScheduleForm({
  id,
  caption,
  defaultCaption,
  whenValue,
  timezone,
}: {
  id: string;
  caption: string;
  /** What gets posted if the caption is left empty. */
  defaultCaption: string;
  whenValue: string;
  timezone: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(editScheduledPost, null);
  return (
    <details className="w-full text-sm">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Edit caption or time
      </summary>
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="id" value={id} />
        <label className="block space-y-1">
          <span className="text-xs font-medium">Caption</span>
          <textarea
            name="caption"
            rows={4}
            maxLength={2200}
            defaultValue={caption}
            placeholder={defaultCaption}
            className="w-full rounded-md border bg-background px-2 py-1 text-sm"
          />
          <span className="block text-xs text-muted-foreground">
            Leave empty to post the default (credit line shown above). Add your own hashtags here.
          </span>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Post at ({timezone})</span>
          <input
            type="datetime-local"
            name="when"
            required
            defaultValue={whenValue}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          />
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {state && (
            <span role="status" className={state.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
              {state.message}
            </span>
          )}
        </div>
      </form>
    </details>
  );
}
