import {
  getSettings,
  insertSchedule,
  listApprovedUnscheduledIds,
  occupiedTimes,
} from "@/db/queries";
import { assignSlots } from "./slots";

export type ScheduleResult = { ok: boolean; message: string; scheduled: number };

/**
 * Give every approved, unscheduled post the next free slot, looking at most `days`
 * days ahead (today counts as day 1). Posts that don't fit stay approved.
 * The oldest approved post gets the earliest slot; one multi-row insert is atomic.
 */
export async function scheduleApprovedPosts(days: number, now: Date = new Date()): Promise<ScheduleResult> {
  const [settings, postIds] = await Promise.all([getSettings(), listApprovedUnscheduledIds()]);
  if (postIds.length === 0) return { ok: false, message: "No approved posts to schedule.", scheduled: 0 };

  const times = assignSlots({
    slots: settings.postSlots,
    timezone: settings.timezone,
    now,
    occupied: await occupiedTimes(now),
    count: postIds.length,
    days,
  });
  if (times.length === 0) {
    return { ok: false, message: `No free slots in the next ${days} day(s).`, scheduled: 0 };
  }

  await insertSchedule(times.map((scheduledAt, i) => ({ scrapedPostId: postIds[i], scheduledAt })));

  const left = postIds.length - times.length;
  return {
    ok: true,
    scheduled: times.length,
    message:
      `Scheduled ${times.length} post${times.length === 1 ? "" : "s"}` +
      (left > 0 ? `; ${left} left unscheduled (no free slots in ${days} days)` : ""),
  };
}

/** Called right after a post is approved: schedules it when the auto-schedule option is on. */
export async function autoScheduleIfEnabled(now: Date = new Date()): Promise<ScheduleResult | null> {
  const settings = await getSettings();
  if (!settings.autoSchedule) return null;
  return scheduleApprovedPosts(settings.autoScheduleDays, now);
}
