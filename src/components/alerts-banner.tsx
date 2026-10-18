import { ChevronRightIcon, CircleAlertIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
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
import { cn } from "@/lib/utils";

const STYLE: Record<Alert["level"], { box: string; icon: typeof InfoIcon; label: string }> = {
  error: { box: "border-destructive/30 bg-destructive/10 text-destructive", icon: CircleAlertIcon, label: "Problem" },
  warn: { box: "border-warning/30 bg-warning/10 text-warning", icon: TriangleAlertIcon, label: "Warning" },
  info: { box: "border-border bg-card text-foreground", icon: InfoIcon, label: "Note" },
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
  const [top, ...rest] = alerts;
  return (
    <div className="space-y-2" role="region" aria-label="Needs your attention">
      <AlertLink alert={top} />
      {rest.length > 0 && (
        <details className="group">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground max-md:min-h-11 [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform duration-150 group-open:rotate-90 motion-reduce:transition-none" aria-hidden />
            {rest.length} more {rest.length === 1 ? "notice" : "notices"}
          </summary>
          <ul className="mt-1 space-y-2">
            {rest.map((a) => (
              <li key={a.text}>
                <AlertLink alert={a} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function AlertLink({ alert: a }: { alert: Alert }) {
  const s = STYLE[a.level];
  const Icon = s.icon;
  return (
    <Link
      href={a.href}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors duration-150 ease-out hover:brightness-95 motion-reduce:transition-none dark:hover:brightness-110",
        s.box,
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">{s.label}: </span>
      <span className="flex-1 font-medium">{a.text}</span>
      <ChevronRightIcon className="size-4 shrink-0 opacity-60" aria-hidden />
    </Link>
  );
}
