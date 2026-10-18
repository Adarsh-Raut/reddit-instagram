// Pure helpers for the review board (keyboard cursor and multi-select). Kept free of React so
// the tricky index and range cases can be unit tested.

/** Keep an index inside the list; -1 when the list is empty. */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return -1;
  return Math.min(Math.max(index, 0), length - 1);
}

/** Move the cursor by `delta`, starting at the first (or last) item when there is no cursor yet. */
export function moveIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  if (current < 0) return delta >= 0 ? 0 : length - 1;
  return clampIndex(current + delta, length);
}

/** Ids from `a` to `b` inclusive, in list order, whichever comes first. Empty if either is missing. */
export function rangeIds(ids: string[], a: string, b: string): string[] {
  const i = ids.indexOf(a);
  const j = ids.indexOf(b);
  if (i === -1 || j === -1) return [];
  return ids.slice(Math.min(i, j), Math.max(i, j) + 1);
}

export function toggleId(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Drop selected ids that are no longer in the list (after a review removed them). */
export function pruneSelection(selected: ReadonlySet<string>, ids: string[]): Set<string> {
  const present = new Set(ids);
  return new Set([...selected].filter((id) => present.has(id)));
}
