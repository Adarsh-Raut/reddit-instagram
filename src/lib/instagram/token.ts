/** Whole days until `date` (negative once it has passed). */
export function daysUntil(date: Date, now: Date = new Date()) {
  return Math.floor((date.getTime() - now.getTime()) / 86_400_000);
}
