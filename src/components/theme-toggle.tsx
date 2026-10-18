"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { IconButton } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Both icons render and CSS picks one, so server and client markup match (no hydration flash).
  return (
    <IconButton
      label="Switch theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </IconButton>
  );
}
