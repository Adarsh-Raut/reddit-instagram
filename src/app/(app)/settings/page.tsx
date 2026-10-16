import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { getLogger } from "@/lib/log";
import { InstagramCard } from "@/components/instagram-card";
import { SettingsForm } from "@/components/settings-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getIgAccount, getSettings } from "@/db/queries";
import { daysUntil } from "@/lib/instagram/token";

const log = getLogger("pages");
async function Content({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  await requireAdmin();
  const ig = (await searchParams).ig;
  let settings, account;
  try {
    [settings, account] = await Promise.all([getSettings(), getIgAccount()]);
  } catch (e) {
    log.error({ err: e }, "Settings load failed");
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load settings</CardTitle>
          <CardDescription>Check DATABASE_URL and that the migration has been applied.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const daysLeft = account ? daysUntil(account.tokenExpiresAt) : null;
  return (
    <>
      <InstagramCard account={account} notice={Array.isArray(ig) ? ig[0] : ig} daysLeft={daysLeft} />
      <SettingsForm settings={settings} />
    </>
  );
}

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
