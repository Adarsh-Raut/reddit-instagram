"use client";

import { useActionState } from "react";
import { addMeme, type AddMemeState } from "@/app/actions/memes";
import { Button } from "@/components/ui/button";

export function AddMemeForm() {
  const [state, action, pending] = useActionState<AddMemeState, FormData>(addMeme, null);
  return (
    <details className="rounded-lg border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Add your own meme</summary>
      <form action={action} className="mt-3 space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium">Image (JPEG, PNG or WebP, up to 10 MB)</span>
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" required className="block w-full text-sm" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium">Title (used as the caption)</span>
          <input
            name="title"
            required
            maxLength={200}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Uploading…" : "Add meme"}
          </Button>
          {state && (
            <p role="status" className={state.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
              {state.message}
            </p>
          )}
        </div>
      </form>
    </details>
  );
}
