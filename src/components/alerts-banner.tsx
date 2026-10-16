import Link from "next/link";
import {
  countFailed,
  getIgAccount,
  getSettings,
  listApprovedUnscheduledIds,
  upcomingStats,
} from "@/db/queries";
import { computeAlerts, type Alert } from "@/lib/alerts";
import { requireAdmin } from "@/lib/auth/session";
import { daysUntil } from "@/lib/instagram/token";

const STYLE: Record<Alert["level"], string> = {
  error: "border-destructive/50 bg-destructive/10 text-destructive",
  warn: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  info: "border-border bg-muted text-muted-foreground",
};

/** Things that need attention. Renders nothing when all is well or the DB isn't reachable. */
export async function AlertsBanner() {
  await requireAdmin(); // also makes this request-time, so it can read the current time
  let alerts: Alert[];
  try {
    const [failedCount, account, upcoming, unscheduled, settings] = await Promise.all([
      countFailed(),
      getIgAccount(),
      upcomingStats(new Date()),
      listApprovedUnscheduledIds(),
      getSettings(),
    ]);
    alerts = computeAlerts({
      failedCount,
      hasAccount: account !== null,
      tokenDaysLeft: account ? daysUntil(account.tokenExpiresAt) : null,
      upcomingCount: upcoming.count,
      slotsPerDay: settings.postSlots.length,
      approvedUnscheduled: unscheduled.length,
      autoSchedule: settings.autoSchedule,
    });
  } catch {
    return null;
  }
  if (alerts.length === 0) return null;
  return (
    <ul className="mx-auto max-w-5xl space-y-2 px-6 pt-4" aria-label="Alerts">
      {alerts.map((a) => (
        <li key={a.text} className={`rounded-md border px-3 py-2 text-sm ${STYLE[a.level]}`}>
          <Link href={a.href} className="hover:underline">
            {a.text}
          </Link>
        </li>
      ))}
    </ul>
  );
}
