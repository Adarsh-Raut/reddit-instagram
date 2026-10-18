"use client";

import { SearchIcon, XIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { controlClass } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { IconButton } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * URL-backed search box. Typing updates `?q=` after a short pause (and resets the page),
 * `/` focuses it from anywhere, and the clear button restores the full list.
 */
export function SearchInput({ label = "Search", placeholder, className }: { label?: string; placeholder: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const id = useId();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  // keep the box in sync when the URL changes elsewhere (tab switch, "Clear search" link)
  const urlQuery = params.get("q") ?? "";
  const [lastUrlQuery, setLastUrlQuery] = useState(urlQuery);
  if (lastUrlQuery !== urlQuery) {
    setLastUrlQuery(urlQuery);
    setValue(urlQuery);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function commit(next: string) {
    const q = new URLSearchParams(params.toString());
    if (next.trim()) q.set("q", next.trim());
    else q.delete("q");
    q.delete("page");
    const qs = q.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function onChange(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(next), 300);
  }

  return (
    <div role="search" className={cn("flex items-center gap-3", className)}>
      <label htmlFor={id} className="text-sm font-medium max-md:sr-only">
        {label}
      </label>
      <div className="relative w-full max-w-sm">
        <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          aria-busy={pending}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              clearTimeout(timer.current);
              commit(value);
            }
            if (e.key === "Escape" && value) {
              onChange("");
              clearTimeout(timer.current);
              commit("");
            }
          }}
          className={cn(controlClass, "h-10 pr-10 pl-9 max-md:h-11 [&::-webkit-search-cancel-button]:hidden")}
        />
        <div className="absolute top-1/2 right-1.5 -translate-y-1/2">
          {value ? (
            <IconButton
              label="Clear search"
              size="icon-sm"
              onClick={() => {
                setValue("");
                clearTimeout(timer.current);
                commit("");
                inputRef.current?.focus();
              }}
            >
              <XIcon />
            </IconButton>
          ) : (
            <Kbd className="mr-1.5 max-md:hidden">/</Kbd>
          )}
        </div>
      </div>
    </div>
  );
}
