import { describe, expect, it } from "vitest";
import { computeAlerts, type AlertInput } from "./alerts";

const healthy: AlertInput = {
  failedCount: 0,
  hasAccount: true,
  tokenDaysLeft: 40,
  upcomingCount: 12,
  slotsPerDay: 3,
  approvedUnscheduled: 0,
  autoSchedule: false,
};
const texts = (over: Partial<AlertInput>) => computeAlerts({ ...healthy, ...over }).map((a) => a.text);

describe("computeAlerts", () => {
  it("is quiet when everything is fine", () => {
    expect(computeAlerts(healthy)).toEqual([]);
  });

  it("flags failed posts as an error, pluralised", () => {
    const [a] = computeAlerts({ ...healthy, failedCount: 1 });
    expect(a).toMatchObject({ level: "error", href: "/schedule" });
    expect(a.text).toBe("1 post failed or missed their slot.");
    expect(texts({ failedCount: 3 })[0]).toBe("3 posts failed or missed their slot.");
  });

  it("covers the Instagram connection states", () => {
    expect(texts({ hasAccount: false, tokenDaysLeft: null, upcomingCount: 0 })[0]).toMatch(/isn.t connected/);
    expect(computeAlerts({ ...healthy, tokenDaysLeft: 0 })[0].level).toBe("error");
    expect(computeAlerts({ ...healthy, tokenDaysLeft: -3 })[0].text).toMatch(/expired/);
    expect(computeAlerts({ ...healthy, tokenDaysLeft: 5 })[0]).toMatchObject({ level: "warn" });
    expect(texts({ tokenDaysLeft: 8 })).toEqual([]);
  });

  it("warns when fewer than two days of posts are queued", () => {
    expect(texts({ upcomingCount: 0 })[0]).toMatch(/Nothing is scheduled/);
    expect(texts({ upcomingCount: 4 })[0]).toBe("Only 4 posts scheduled (about 1 day). Approve more memes.");
    expect(texts({ upcomingCount: 6 })).toEqual([]);
  });

  it("doesn't nag about an empty queue when Instagram isn't connected", () => {
    expect(texts({ hasAccount: false, tokenDaysLeft: null, upcomingCount: 0 })).toHaveLength(1);
  });

  it("mentions unscheduled approved posts only when auto-schedule is off", () => {
    expect(texts({ approvedUnscheduled: 2 })).toEqual(["2 approved memes aren’t scheduled yet."]);
    expect(texts({ approvedUnscheduled: 1 })[0]).toMatch(/1 approved meme isn.t/);
    expect(texts({ approvedUnscheduled: 2, autoSchedule: true })).toEqual([]);
  });

  it("orders the most urgent first", () => {
    const levels = computeAlerts({ ...healthy, failedCount: 1, tokenDaysLeft: 2, approvedUnscheduled: 1 }).map((a) => a.level);
    expect(levels).toEqual(["error", "warn", "info"]);
  });
});
