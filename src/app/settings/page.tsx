import { Suspense } from "react";
import { SettingsForm } from "@/components/settings-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettings } from "@/db/queries";

async function Form() {
  let settings;
  try {
    settings = await getSettings();
  } catch (e) {
    console.error("Settings load failed", e);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Couldn’t load settings</CardTitle>
          <CardDescription>Check DATABASE_URL and that the migration has been applied.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  return <SettingsForm settings={settings} />;
}

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <Form />
      </Suspense>
    </main>
  );
}
