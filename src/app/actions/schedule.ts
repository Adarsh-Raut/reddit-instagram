"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getSettings,
  insertSchedule,
  listApprovedUnscheduledIds,
  occupiedTimes,
  saveSettings,
  unschedule,
} from "@/db/queries";
import { assignSlots } from "@/lib/schedule/slots";
import { settingsInput } from "@/lib/settings";

// TODO(auth): same as actions/posts.ts, verify an authenticated admin before deploying.

export type ActionState = { ok: boolean; message: string } | null;

const daysSchema = z.coerce.number().int().min(1).max(90);

/**
 * Give every approved, unscheduled post the next free slot, looking at most
 * `days` days ahead (today counts as day 1). Posts that don't fit stay approved.
 */
export async function scheduleApproved(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const days = daysSchema.safeParse(formData.get("days"));
  if (!days.success) return { ok: false, message: "Days must be between 1 and 90." };

  try {
    const [settings, postIds] = await Promise.all([getSettings(), listApprovedUnscheduledIds()]);
    if (postIds.length === 0) return { ok: false, message: "No approved posts to schedule." };

    const now = new Date();
    const times = assignSlots({
      slots: settings.postSlots,
      timezone: settings.timezone,
      now,
      occupied: await occupiedTimes(now),
      count: postIds.length,
      days: days.data,
    });
    if (times.length === 0) {
      return { ok: false, message: `No free slots in the next ${days.data} day(s).` };
    }

    // oldest approved post gets the earliest slot; one multi-row insert is atomic
    await insertSchedule(times.map((scheduledAt, i) => ({ scrapedPostId: postIds[i], scheduledAt })));
    revalidatePath("/", "layout");

    const left = postIds.length - times.length;
    return {
      ok: true,
      message:
        `Scheduled ${times.length} post${times.length === 1 ? "" : "s"}` +
        (left > 0 ? `; ${left} left unscheduled (no free slots in ${days.data} days)` : ""),
    };
  } catch (e) {
    console.error("scheduleApproved failed", e);
    return {
      ok: false,
      message: "Couldn’t schedule. Someone may have taken a slot, so try again.",
    };
  }
}

export async function unschedulePost(formData: FormData) {
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
  const parsed = settingsInput.safeParse({
    subreddits: formData.get("subreddits"),
    scrapeCount: formData.get("scrapeCount"),
    postSlots: formData.get("postSlots"),
    timezone: formData.get("timezone"),
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
