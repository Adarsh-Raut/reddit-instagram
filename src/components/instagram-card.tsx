"use client";

import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { disconnectInstagram } from "@/app/actions/instagram";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { IgAccount } from "@/db/queries";

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Instagram is connected. Scheduled posts will go out on time." },
  denied: { ok: false, text: "Instagram access wasn’t granted. Connect again and approve the permissions." },
  "bad-state": { ok: false, text: "The sign-in session expired. Connect Instagram again to continue." },
  "not-configured": { ok: false, text: "Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET to .env.local, then restart the server." },
  error: { ok: false, text: "We couldn’t connect Instagram. Try again, or check the server logs." },
};

export function InstagramCard({
  account,
  notice,
  daysLeft,
}: {
  account: IgAccount | null;
  notice?: string;
  /** Computed by the caller so this stays a pure render. */
  daysLeft: number | null;
}) {
  const n = notice ? NOTICES[notice] : undefined;
  const expired = daysLeft !== null && daysLeft <= 0;
  const handle = account ? `@${account.username ?? account.igUserId}` : "";
  return (
    <div className="space-y-4">
      {n && (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
            n.ok ? "border-success/30 bg-success/10 text-success" : "border-destructive/30 bg-destructive/10 text-destructive",
          )}
        >
          {n.ok ? <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />}
          {n.text}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          {account ? (
            <>
              <p className="flex items-center gap-2 text-sm font-medium">
                <span className={cn("size-2 rounded-full", expired ? "bg-destructive" : "bg-success")} aria-hidden />
                {handle}
                <span className={cn("font-normal", expired ? "text-destructive" : "text-muted-foreground")}>
                  {expired ? "Connection expired" : "Connected"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                {expired
                  ? "Reconnect to resume posting. Nothing is published while the connection is expired."
                  : daysLeft !== null
                    ? `Renews automatically. The current sign-in is valid for ${daysLeft} more ${daysLeft === 1 ? "day" : "days"}.`
                    : "Posts are published to this account."}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Not connected</p>
              <p className="max-w-prose text-sm text-muted-foreground">
                Connect an Instagram Business or Creator account to publish memes. Nothing is posted until you do.
              </p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          {/* plain link: this starts an OAuth redirect, not a client navigation */}
          <a href="/api/instagram/connect" className={buttonVariants({ variant: account && !expired ? "outline" : "default" })}>
            {account ? "Reconnect Instagram" : "Connect Instagram"}
          </a>
          {account && (
            <ConfirmDialog
              trigger={<Button variant="outline">Disconnect</Button>}
              title={`Disconnect ${handle}?`}
              description="Scheduled posts stay in the queue but won’t be published until you connect an account again."
              confirmLabel={`Disconnect ${handle}`}
              destructive
              onConfirm={() => {
                disconnectInstagram().then(
                  () => toast("Instagram disconnected"),
                  () => toast.error("We couldn’t disconnect Instagram. Try again."),
                );
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
