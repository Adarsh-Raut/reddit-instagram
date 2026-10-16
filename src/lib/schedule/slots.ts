import { TZDate } from "@date-fns/tz";

const SLOT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidSlot(s: string) {
  return SLOT_RE.test(s);
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns up to `count` upcoming post times (UTC instants), in order.
 * Each day in `timezone` contributes one instant per "HH:mm" slot.
 *
 * - Only instants strictly after `now` are used.
 * - Instants in `occupied` (epoch ms) are skipped, so slots are never double-booked.
 * - Searches `days` calendar days starting with today (in `timezone`).
 */
export function assignSlots(opts: {
  slots: string[];
  timezone: string;
  now: Date;
  occupied: Iterable<number>;
  count: number;
  days: number;
}): Date[] {
  const { timezone, now, count, days } = opts;
  const slots = [...new Set(opts.slots.filter(isValidSlot))].sort();
  if (slots.length === 0 || count <= 0 || days <= 0) return [];

  const taken = new Set(opts.occupied);
  const today = new TZDate(now, timezone);
  const out: Date[] = [];

  for (let d = 0; d < days && out.length < count; d++) {
    for (const slot of slots) {
      const [h, m] = slot.split(":").map(Number);
      const at = new TZDate(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + d,
        h,
        m,
        0,
        0,
        timezone,
      ).getTime();
      if (at > now.getTime() && !taken.has(at)) {
        taken.add(at);
        out.push(new Date(at));
        if (out.length >= count) break;
      }
    }
  }
  return out;
}

/** Display a UTC instant in the configured timezone, e.g. "Mon, Oct 19, 9:00 AM". */
export function formatInTimezone(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** Calendar-day key (YYYY-MM-DD) of an instant in the configured timezone. */
export function dayKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
