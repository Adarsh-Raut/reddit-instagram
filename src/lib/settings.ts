import { z } from "zod";
import { isValidSlot, isValidTimezone } from "./schedule/slots";

const list = (v: unknown) =>
  String(v ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const settingsInput = z.object({
  subreddits: z
    .unknown()
    .transform((v) => [...new Set(list(v).map((s) => s.replace(/^\/?r\//i, "")))])
    .pipe(
      z
        .array(z.string().regex(/^[A-Za-z0-9_]{2,21}$/, "Invalid subreddit name"))
        .min(1, "Add at least one subreddit")
        .max(10),
    ),
  scrapeCount: z.coerce.number().int().min(1).max(50),
  postSlots: z
    .unknown()
    .transform((v) => [...new Set(list(v))].sort())
    .pipe(
      z
        .array(z.string().refine(isValidSlot, "Slots must look like 09:00 (24h)"))
        .min(1, "Add at least one post time")
        .max(12),
    ),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
});

export type SettingsInput = z.infer<typeof settingsInput>;
