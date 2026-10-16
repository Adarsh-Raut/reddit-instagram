import { insertActivity } from "@/db/queries";
import { getLogger, redactDeep } from "./log";

export type ActivityLevel = "info" | "warn" | "error";

export type ActivityEvent = {
  level: ActivityLevel;
  /** Dotted category, e.g. "publish.posted", "scrape.completed", "auth.login_failed". */
  kind: string;
  message: string;
  meta?: Record<string, unknown>;
};

const log = getLogger("activity");
const MAX_MESSAGE = 500;

/**
 * Record a business event: written to the terminal/host log AND to the database
 * (shown on /activity). Never throws; a logging failure must not break a publish.
 * Secret-looking meta keys are redacted before storing.
 */
export async function recordActivity(
  event: ActivityEvent,
  insert: typeof insertActivity = insertActivity,
): Promise<void> {
  const message = event.message.length > MAX_MESSAGE ? `${event.message.slice(0, MAX_MESSAGE - 1)}…` : event.message;
  const meta = event.meta ? (redactDeep(event.meta) as Record<string, unknown>) : undefined;
  log[event.level]({ kind: event.kind, ...meta }, message);
  try {
    await insert({ level: event.level, kind: event.kind, message, meta });
  } catch (err) {
    log.error({ err, kind: event.kind }, "could not store activity event");
  }
}
