"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

type ActionResult = { ok: boolean; message: string } | null;

/** Shows each new server-action result once as a toast (success or error). */
export function useActionToast(state: ActionResult) {
  const shown = useRef<ActionResult>(null);
  useEffect(() => {
    if (!state || state === shown.current) return;
    shown.current = state;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);
}
