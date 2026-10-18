"use client";

import { CheckIcon, CopyIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { describeError, formatErrorDetails } from "@/lib/error-details";

/**
 * What the user sees when a page crashes: what happened, that their data is fine, and how to
 * recover. Technical detail stays out of sight; "Copy error details" gives support the reference.
 */
export function ErrorView({ error, retry }: { error: unknown; retry?: () => void }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const [manualText, setManualText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const reference = describeError(error, "").reference;

  async function copy() {
    const text = formatErrorDetails(describeError(error, window.location.pathname));
    try {
      await navigator.clipboard.writeText(text);
      setCopied("done");
      setManualText(null);
    } catch {
      // clipboard blocked (permissions, insecure origin): show the text so it can be copied by hand
      setCopied("failed");
      setManualText(text);
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied("idle"), 2500);
  }

  return (
    <section role="alert" className="flex flex-col items-center px-6 py-16 text-center">
      <TriangleAlertIcon className="mb-4 size-6 text-warning" aria-hidden />
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        We couldn’t show this page. Your memes and schedule aren’t affected. Try again, and if it keeps happening, send us the error details.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {retry && (
          <Button onClick={() => retry()}>
            <RotateCcwIcon data-icon="inline-start" />
            Try again
          </Button>
        )}
        {/* plain link on purpose: a full reload also clears any broken client state */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className={buttonVariants({ variant: "outline" })}>
          Go to Memes
        </a>
        <Button variant="ghost" onClick={copy}>
          {copied === "done" ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
          {copied === "done" ? "Copied" : copied === "failed" ? "Couldn’t copy" : "Copy error details"}
        </Button>
      </div>
      {manualText && (
        <div className="mt-4 w-full max-w-sm space-y-1.5 text-left">
          <label htmlFor="error-details" className="block text-sm font-medium">
            Error details
          </label>
          <textarea
            id="error-details"
            readOnly
            rows={7}
            value={manualText}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-input bg-muted p-2 font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">Select the text and copy it with your keyboard.</p>
        </div>
      )}
      {reference && (
        <p className="mt-6 text-xs text-muted-foreground">
          Reference <code className="font-mono">{reference}</code>. Search the server logs for it to find the cause.
        </p>
      )}
    </section>
  );
}
