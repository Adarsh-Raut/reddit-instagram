import { Suspense } from "react";
import { AlertsBanner } from "@/components/alerts-banner";
import { AppShell } from "@/components/app-shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      <Suspense>
        <AlertsBanner />
      </Suspense>
      {children}
    </AppShell>
  );
}
