"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export const SETTINGS_SECTIONS = [
  { id: "instagram", label: "Instagram" },
  { id: "posting", label: "Sources and post times" },
  { id: "automation", label: "Automation" },
] as const;

/** Sticky section list beside the content on wide screens; a jump menu above it on narrow ones. */
export function SettingsNav() {
  const [active, setActive] = useState<string>(SETTINGS_SECTIONS[0].id);

  useEffect(() => {
    const els = SETTINGS_SECTIONS.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => !!e);
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-10% 0px -70% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <nav aria-label="Settings sections" className="sticky top-8 hidden self-start md:block">
        <ul className="space-y-1">
          {SETTINGS_SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active === s.id ? "location" : undefined}
                className={cn(
                  "block rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 ease-out motion-reduce:transition-none",
                  active === s.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-1.5 md:hidden">
        <label htmlFor="settings-jump" className="block text-sm font-medium">
          Jump to section
        </label>
        <Select
          id="settings-jump"
          value={active}
          onChange={(e) => {
            setActive(e.target.value);
            document.getElementById(e.target.value)?.scrollIntoView({ behavior: "auto", block: "start" });
          }}
        >
          {SETTINGS_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}
