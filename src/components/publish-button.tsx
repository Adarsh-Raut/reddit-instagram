"use client";

import { useActionState } from "react";
import { publishNow, type PublishState } from "@/app/actions/instagram";
import { Button } from "@/components/ui/button";

export function PublishButton({ id, retry }: { id: string; retry?: boolean }) {
  const [state, action, pending] = useActionState<PublishState, FormData>(publishNow, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Publish this meme to Instagram right now?")) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Publishing…" : retry ? "Retry" : "Publish now"}
      </Button>
      {state && !state.ok && (
        <span role="alert" className="max-w-48 truncate text-xs text-destructive" title={state.message}>
          {state.message}
        </span>
      )}
    </form>
  );
}
