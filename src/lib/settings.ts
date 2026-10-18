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
  // checkboxes: "on" when ticked, absent when not
  autoScrape: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  autoSchedule: z.preprocess((v) => v === "on" || v === true, z.boolean()),
  autoScheduleDays: z.coerce.number().int().min(1).max(90),
});

export type SettingsInput = z.infer<typeof settingsInput>;

/** The fields the Settings form edits. The automation switches save on their own. */
export const settingsFormInput = settingsInput.pick({
  subreddits: true,
  scrapeCount: true,
  postSlots: true,
  timezone: true,
});

/** One automation switch (or the look-ahead days) changed. Anything omitted stays as it is. */
export const automationPatch = z
  .object({
    autoScrape: z.boolean().optional(),
    autoSchedule: z.boolean().optional(),
    autoScheduleDays: z.number().int().min(1, "Use between 1 and 90 days.").max(90, "Use between 1 and 90 days.").optional(),
  })
  .strict();

export type AutomationPatch = z.infer<typeof automationPatch>;
