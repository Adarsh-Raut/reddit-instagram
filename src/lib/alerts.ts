export type Alert = { level: "error" | "warn" | "info"; text: string; href: string };

export type AlertInput = {
  failedCount: number;
  hasAccount: boolean;
  /** Days until the Instagram token expires; negative once expired. Null when not connected. */
  tokenDaysLeft: number | null;
  upcomingCount: number;
  slotsPerDay: number;
  approvedUnscheduled: number;
  autoSchedule: boolean;
};

/** Things that need the admin's attention, most urgent first. Pure so it is easy to test. */
export function computeAlerts(i: AlertInput): Alert[] {
  const out: Alert[] = [];
  if (i.failedCount > 0) {
    out.push({
      level: "error",
      text: `${i.failedCount} post${i.failedCount === 1 ? "" : "s"} failed or missed their slot.`,
      href: "/schedule",
    });
  }
  if (!i.hasAccount) {
    out.push({ level: "warn", text: "Instagram isn’t connected, so nothing will be posted.", href: "/settings" });
  } else if (i.tokenDaysLeft !== null && i.tokenDaysLeft <= 0) {
    out.push({ level: "error", text: "The Instagram token has expired. Reconnect to resume posting.", href: "/settings" });
  } else if (i.tokenDaysLeft !== null && i.tokenDaysLeft <= 7) {
    out.push({ level: "warn", text: `The Instagram token expires in ${i.tokenDaysLeft} day(s).`, href: "/settings" });
  }
  if (i.hasAccount && i.slotsPerDay > 0 && i.upcomingCount < i.slotsPerDay * 2) {
    const days = Math.floor(i.upcomingCount / i.slotsPerDay);
    out.push({
      level: "warn",
      text:
        i.upcomingCount === 0
          ? "Nothing is scheduled. Approve and schedule more memes."
          : `Only ${i.upcomingCount} post${i.upcomingCount === 1 ? "" : "s"} scheduled (about ${days} day${days === 1 ? "" : "s"}). Approve more memes.`,
      href: "/",
    });
  }
  if (i.approvedUnscheduled > 0 && !i.autoSchedule) {
    out.push({
      level: "info",
      text: `${i.approvedUnscheduled} approved meme${i.approvedUnscheduled === 1 ? " isn’t" : "s aren’t"} scheduled yet.`,
      href: "/?status=approved",
    });
  }
  return out;
}
