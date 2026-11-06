"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getScheduleCaptionInfo,
  getSchedulePost,
  getSettings,
  rescheduleTo,
  saveSettings,
  unschedule,
  updateScheduleCaption,
} from "@/db/queries";
import { recordActivity } from "@/lib/activity";
import { generateCaptionFor } from "@/lib/ai/run";
import { requireAdmin } from "@/lib/auth/session";
import { getLogger } from "@/lib/log";
import { parseLocalDateTime } from "@/lib/schedule/local-time";
import { scheduleApprovedPosts } from "@/lib/schedule/service";
import { automationPatch, settingsFormInput, type AutomationPatch } from "@/lib/settings";

const log = getLogger("actions");

export type ActionState = { ok: boolean; message: string } | null;

const daysSchema = z.coerce.number().int().min(1).max(90);

export async function scheduleApproved(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const days = daysSchema.safeParse(formData.get("days"));
  if (!days.success) return { ok: false, message: "Days must be between 1 and 90." };

  try {
    const r = await scheduleApprovedPosts(days.data);
    revalidatePath("/", "layout");
    return { ok: r.ok, message: r.message };
  } catch (e) {
    log.error({ err: e }, "scheduleApproved failed");
    return {
      ok: false,
      message: "Couldn’t schedule. Someone may have taken a slot, so try again.",
    };
  }
}

export async function unschedulePost(formData: FormData) {
  await requireAdmin();
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  await unschedule(id.data);
  await recordActivity({ level: "info", kind: "schedule.removed", message: "Removed a post from the schedule", meta: { scheduleId: id.data } });
  revalidatePath("/", "layout");
}

export type SettingsState = { ok: boolean; message: string } | null;

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();
  const parsed = settingsFormInput.safeParse({
    subreddits: formData.get("subreddits"),
    scrapeCount: formData.get("scrapeCount"),
    postSlots: formData.get("postSlots"),
    timezone: formData.get("timezone"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }
  try {
    // the automation switches save on their own, so keep whatever they are now
    const current = await getSettings();
    await saveSettings({
      ...parsed.data,
      autoScrape: current.autoScrape,
      autoSchedule: current.autoSchedule,
      autoScheduleDays: current.autoScheduleDays,
      aiCaptions: current.aiCaptions,
    });
    await recordActivity({ level: "info", kind: "settings.saved", message: "Settings updated", meta: { slots: parsed.data.postSlots, timezone: parsed.data.timezone, subreddits: parsed.data.subreddits } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    log.error({ err: e }, "updateSettings failed");
    return { ok: false, message: "We couldn’t save your settings. Check your connection and try again." };
  }
}

/** Saves one automation change immediately (the switches in Settings → Automation). */
export async function updateAutomation(patch: AutomationPatch): Promise<SettingsState> {
  await requireAdmin();
  const parsed = automationPatch.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "That setting isn’t valid." };
  }
  try {
    const current = await getSettings();
    const next = {
      subreddits: current.subreddits,
      scrapeCount: current.scrapeCount,
      postSlots: current.postSlots,
      timezone: current.timezone,
      autoScrape: parsed.data.autoScrape ?? current.autoScrape,
      autoSchedule: parsed.data.autoSchedule ?? current.autoSchedule,
      autoScheduleDays: parsed.data.autoScheduleDays ?? current.autoScheduleDays,
      aiCaptions: parsed.data.aiCaptions ?? current.aiCaptions,
    };
    await saveSettings(next);
    await recordActivity({ level: "info", kind: "settings.saved", message: "Automation settings updated", meta: parsed.data });
    revalidatePath("/", "layout");
    return { ok: true, message: "Saved." };
  } catch (e) {
    log.error({ err: e }, "updateAutomation failed");
    return { ok: false, message: "We couldn’t save that change. Check your connection and try again." };
  }
}

const editSchema = z.object({
  id: z.string().uuid(),
  caption: z.string().max(2200, "Captions can be at most 2,200 characters."),
  when: z.string().min(1, "Pick a date and time."),
});

/** Edit the caption and/or time of a post that hasn't been published yet. */
export async function editScheduledPost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = editSchema.safeParse({
    id: formData.get("id"),
    caption: String(formData.get("caption") ?? "").replace(/\r\n/g, "\n").trim(),
    when: formData.get("when"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };

  try {
    const [settings, current] = await Promise.all([getSettings(), getScheduleCaptionInfo(parsed.data.id)]);
    if (!current) return { ok: false, message: "That post no longer exists." };
    const at = parseLocalDateTime(parsed.data.when, settings.timezone);
    if (!at) return { ok: false, message: "That date and time isn’t valid." };

    const timeChanged = at.getTime() !== current.scheduledAt.getTime();
    if (timeChanged && at.getTime() <= Date.now()) {
      return { ok: false, message: "Pick a time in the future." };
    }
    if (parsed.data.caption !== current.caption) {
      if (!(await updateScheduleCaption(parsed.data.id, parsed.data.caption))) {
        return { ok: false, message: "This post can’t be edited any more." };
      }
    }
    if (timeChanged && !(await rescheduleTo(parsed.data.id, at))) {
      return { ok: false, message: "This post can’t be moved any more." };
    }
    revalidatePath("/", "layout");
    await recordActivity({ level: "info", kind: "schedule.edited", message: "Edited a scheduled post", meta: { scheduleId: parsed.data.id, timeChanged, captionChanged: parsed.data.caption !== current.caption } });
    return { ok: true, message: "Saved." };
  } catch (e) {
    // the unique(scheduled_at) constraint: another post already owns that minute
    log.error({ err: e }, "editScheduledPost failed");
    return { ok: false, message: "That time slot is already taken by another post." };
  }
}

export type SuggestState = { ok: true; caption: string; provider: string } | { ok: false; message: string };

/**
 * "Write with AI" in the edit panel: returns a suggested caption for the admin to review.
 * Nothing is saved until they press Save changes.
 */
export async function suggestCaption(scheduleId: string): Promise<SuggestState> {
  await requireAdmin();
  const id = z.string().uuid().safeParse(scheduleId);
  if (!id.success) return { ok: false, message: "Invalid post." };
  const post = await getSchedulePost(id.data);
  if (!post) return { ok: false, message: "That post no longer exists." };
  const r = await generateCaptionFor(post);
  if (r.ok) return { ok: true, caption: r.caption, provider: r.provider };
  log.warn({ failures: r.failures }, "suggestCaption failed");
  return { ok: false, message: "The AI services didn’t answer. Try again in a moment, or write the caption yourself." };
}
