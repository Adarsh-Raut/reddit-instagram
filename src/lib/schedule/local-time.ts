import { TZDate } from "@date-fns/tz";

const INPUT_RE = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/;

/** Parse an <input type="datetime-local"> value as wall-clock time in `timezone`. */
export function parseLocalDateTime(value: string, timezone: string): Date | null {
  const m = INPUT_RE.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new TZDate(y, mo - 1, d, h, mi, 0, 0, timezone);
  // reject impossible dates like Feb 31 (they would roll over silently)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return new Date(date.getTime());
}

/** Format an instant as a datetime-local value in `timezone`. */
export function toLocalInputValue(date: Date, timezone: string): string {
  const t = new TZDate(date, timezone);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}T${p(t.getHours())}:${p(t.getMinutes())}`;
}
