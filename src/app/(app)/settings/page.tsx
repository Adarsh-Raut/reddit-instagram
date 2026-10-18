import Link from "next/link";
import { Suspense } from "react";
import { AutomationSettings } from "@/components/automation-settings";
import { InstagramCard } from "@/components/instagram-card";
import { SettingsForm } from "@/components/settings-form";
import { SettingsNav } from "@/components/settings-nav";
import { SettingsSkeleton } from "@/components/skeletons";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { getIgAccount, getSettings } from "@/db/queries";
import { requireAdmin } from "@/lib/auth/session";
import { daysUntil } from "@/lib/instagram/token";
import { getLogger } from "@/lib/log";

const log = getLogger("pages");

export const metadata = { title: "Settings" };

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8 space-y-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-xl border bg-card p-5 shadow-soft">{children}</div>
    </section>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/settings">["searchParams"] }) {
  await requireAdmin();
  const ig = (await searchParams).ig;
  let settings, account;
  try {
    [settings, account] = await Promise.all([getSettings(), getIgAccount()]);
  } catch (e) {
    log.error({ err: e }, "Settings load failed");
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          title="We couldn’t load your settings"
          description="The database didn’t respond, so nothing was lost. Reload to try again. If it keeps happening, check the server logs."
        >
          <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
            Reload page
          </Link>
        </EmptyState>
      </div>
    );
  }
  const daysLeft = account ? daysUntil(account.tokenExpiresAt) : null;
  const timezones = Intl.supportedValuesOf("timeZone");
  return (
    <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-10">
      <SettingsNav />
      <div className="max-w-2xl space-y-10">
        <Section id="instagram" title="Instagram" description="The account your memes are published to.">
          <InstagramCard account={account} notice={Array.isArray(ig) ? ig[0] : ig} daysLeft={daysLeft} />
        </Section>
        <Section id="posting" title="Sources and post times" description="Where memes come from and when they go out.">
          <SettingsForm settings={settings} timezones={timezones} />
        </Section>
        <Section id="automation" title="Automation" description="Let the app do the routine work. These save as soon as you change them.">
          <AutomationSettings
            autoScrape={settings.autoScrape}
            autoSchedule={settings.autoSchedule}
            autoScheduleDays={settings.autoScheduleDays}
          />
        </Section>
      </div>
    </div>
  );
}

export default function SettingsPage({ searchParams }: PageProps<"/settings">) {
  return (
    <>
      <PageHeader title="Settings" description="Connect Instagram, choose where memes come from, and set your posting rhythm." />
      <Suspense fallback={<SettingsSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
