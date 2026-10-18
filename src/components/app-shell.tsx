"use client";

import {
  ActivityIcon,
  CalendarClockIcon,
  ImagesIcon,
  LogOutIcon,
  MenuIcon,
  SendIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/actions/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { IconButton } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Memes", icon: ImagesIcon },
  { href: "/schedule", label: "Schedule", icon: CalendarClockIcon },
  { href: "/activity", label: "Activity", icon: ActivityIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md outline-offset-4">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <SendIcon className="size-4" aria-hidden />
      </span>
      <span className="text-sm leading-tight font-semibold">Reddit → Instagram</span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors duration-150 ease-out motion-reduce:transition-none max-md:min-h-11",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter() {
  return (
    <div className="flex items-center justify-between gap-2">
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
          <LogOutIcon data-icon="inline-start" />
          Sign out
        </Button>
      </form>
      <ThemeToggle />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  // close the mobile menu after any navigation (including browser back)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-card px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>

      {/* wide: fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between border-r bg-sidebar p-4 md:flex">
        <div className="space-y-6">
          <Brand />
          <NavLinks />
        </div>
        <SidebarFooter />
      </aside>

      {/* narrow: top bar + the same nav in a slide-over */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b bg-background px-4 py-2 md:hidden">
        <Brand />
        <IconButton label="Open menu" onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </IconButton>
      </div>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" title="Menu" className="max-w-80 md:hidden">
          <div className="flex flex-1 flex-col justify-between p-4">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
            <SidebarFooter />
          </div>
        </SheetContent>
      </Sheet>

      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
