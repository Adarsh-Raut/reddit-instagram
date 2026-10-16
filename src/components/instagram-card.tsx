import { disconnectInstagram } from "@/app/actions/instagram";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IgAccount } from "@/db/queries";

const NOTICES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Instagram connected." },
  denied: { ok: false, text: "Instagram access was denied." },
  "bad-state": { ok: false, text: "Login session expired or didn’t match. Please try again." },
  "not-configured": { ok: false, text: "Set INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in .env.local first." },
  error: { ok: false, text: "Couldn’t connect Instagram. Check the server logs." },
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Instagram
          {account && <Badge variant={expired ? "destructive" : "secondary"}>{expired ? "Expired" : "Connected"}</Badge>}
        </CardTitle>
        <CardDescription>
          {account
            ? `@${account.username ?? account.igUserId}${daysLeft !== null && !expired ? ` · token valid for ${daysLeft} more days` : ""}`
            : "Connect a Business or Creator account to publish memes."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {n && (
          <p role="status" className={n.ok ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>
            {n.text}
          </p>
        )}
        <div className="flex gap-2">
          {/* plain link: this starts an OAuth redirect, not a client navigation */}
          <a
            href="/api/instagram/connect"
            className={cn(buttonVariants({ variant: account && !expired ? "outline" : "default" }))}
          >
            {account ? "Reconnect" : "Connect Instagram"}
          </a>
          {account && (
            <form action={disconnectInstagram}>
              <Button type="submit" variant="outline">Disconnect</Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
