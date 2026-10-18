"use client";

import { useEffect, type CSSProperties } from "react";
import { ErrorView } from "@/components/error-view";
import "./globals.css";

/**
 * Last resort: the root layout itself failed, so this replaces it (own <html>/<body>, no
 * providers, no theme toggle). It follows the OS light/dark setting instead.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  return (
    // the root layout (which loads Geist) is gone, so point the font variable at the system font
    <html lang="en" style={{ "--font-geist-sans": "system-ui" } as CSSProperties}>
      <body className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground antialiased">
        <title>Something went wrong · Reddit → Instagram</title>
        <div className="w-full max-w-md rounded-xl border bg-card shadow-soft">
          <ErrorView error={error} retry={retry} />
        </div>
      </body>
    </html>
  );
}
