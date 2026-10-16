import { Suspense } from "react";
import { AlertsBanner } from "@/components/alerts-banner";
import { SiteNav } from "@/components/site-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteNav />
      <Suspense>
        <AlertsBanner />
      </Suspense>
      {children}
    </>
  );
}
