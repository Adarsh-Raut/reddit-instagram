"use client";

import { ErrorView } from "@/components/error-view";

/** A page inside the app crashed. The sidebar stays, so the user can navigate away or retry. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="rounded-xl border bg-card shadow-soft">
      <ErrorView error={error} retry={retry} />
    </div>
  );
}
