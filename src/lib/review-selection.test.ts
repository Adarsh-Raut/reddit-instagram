import { describe, expect, it } from "vitest";
import { clampIndex, moveIndex, pruneSelection, rangeIds, toggleId } from "./review-selection";

describe("clampIndex", () => {
  it("keeps the index inside the list", () => {
    expect(clampIndex(5, 3)).toBe(2);
    expect(clampIndex(-4, 3)).toBe(0);
    expect(clampIndex(1, 3)).toBe(1);
  });
  it("is -1 for an empty list", () => {
    expect(clampIndex(0, 0)).toBe(-1);
  });
  it("points at the next card after the current one was removed (same index)", () => {
    // 3 cards, cursor on the last; it is reviewed away, 2 remain: cursor lands on the new last
    expect(clampIndex(2, 2)).toBe(1);
  });
});

describe("moveIndex", () => {
  it("starts at the first card going forward and the last going back when there is no cursor", () => {
    expect(moveIndex(-1, 1, 5)).toBe(0);
    expect(moveIndex(-1, -1, 5)).toBe(4);
  });
  it("moves and stops at both ends instead of wrapping", () => {
    expect(moveIndex(1, 1, 5)).toBe(2);
    expect(moveIndex(4, 1, 5)).toBe(4);
    expect(moveIndex(0, -1, 5)).toBe(0);
  });
  it("does nothing on an empty list", () => {
    expect(moveIndex(-1, 1, 0)).toBe(-1);
  });
});

describe("rangeIds", () => {
  const ids = ["a", "b", "c", "d", "e"];
  it("returns the inclusive range in either direction", () => {
    expect(rangeIds(ids, "b", "d")).toEqual(["b", "c", "d"]);
    expect(rangeIds(ids, "d", "b")).toEqual(["b", "c", "d"]);
    expect(rangeIds(ids, "c", "c")).toEqual(["c"]);
  });
  it("is empty when either end is not in the list", () => {
    expect(rangeIds(ids, "a", "zzz")).toEqual([]);
    expect(rangeIds(ids, "zzz", "a")).toEqual([]);
  });
});

describe("toggleId and pruneSelection", () => {
  it("toggles without mutating the original set", () => {
    const original = new Set(["a"]);
    const added = toggleId(original, "b");
    expect([...added].sort()).toEqual(["a", "b"]);
    expect([...original]).toEqual(["a"]);
    expect([...toggleId(added, "a")]).toEqual(["b"]);
  });
  it("drops ids that left the list", () => {
    expect([...pruneSelection(new Set(["a", "b", "gone"]), ["a", "b", "c"])].sort()).toEqual(["a", "b"]);
  });
});
