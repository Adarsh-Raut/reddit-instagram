import { expect, it } from "vitest";
import { daysUntil } from "./token";

it("counts whole days, negative when expired", () => {
  const now = new Date("2026-10-16T00:00:00Z");
  expect(daysUntil(new Date("2026-10-26T12:00:00Z"), now)).toBe(10);
  expect(daysUntil(new Date("2026-10-15T00:00:00Z"), now)).toBe(-1);
});
