"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getScheduleCaptionInfo,
  getSettings,
  rescheduleTo,
  saveSettings,
  unschedule,
  updateScheduleCaption,
} from "@/db/queries";
import { requireAdmin } from "@/lib/auth/session";
import { parseLocalDateTime } from "@/lib/schedule/local-time";
import { scheduleApprovedPosts } from "@/lib/schedule/service";
import { settingsInput } from "@/lib/settings";

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
    console.error("scheduleApproved failed", e);
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
  revalidatePath("/", "layout");
}

export type SettingsState = { ok: boolean; message: string } | null;

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();
  const parsed = settingsInput.safeParse({
    subreddits: formData.get("subreddits"),
    scrapeCount: formData.get("scrapeCount"),
    postSlots: formData.get("postSlots"),
    timezone: formData.get("timezone"),
    autoScrape: formData.get("autoScrape"),
    autoSchedule: formData.get("autoSchedule"),
    autoScheduleDays: formData.get("autoScheduleDays"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }
  try {
    await saveSettings(parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    console.error("updateSettings failed", e);
    return { ok: false, message: "Couldn’t save settings." };
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
    return { ok: true, message: "Saved." };
  } catch (e) {
    // the unique(scheduled_at) constraint: another post already owns that minute
    console.error("editScheduledPost failed", e);
    return { ok: false, message: "That time slot is already taken by another post." };
  }
}
