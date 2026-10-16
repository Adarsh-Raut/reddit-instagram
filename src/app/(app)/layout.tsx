import { SiteNav } from "@/components/site-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteNav />
      {children}
    </>
  );
}
