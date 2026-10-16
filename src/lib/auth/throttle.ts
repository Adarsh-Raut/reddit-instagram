/** Best-effort in-memory login throttle (per server instance). */
export function createThrottle(max = 5, windowMs = 15 * 60 * 1000) {
  const failures = new Map<string, number[]>();
  const recent = (key: string, now: number) => (failures.get(key) ?? []).filter((t) => now - t < windowMs);
  return {
    isBlocked(key: string, now = Date.now()) {
      return recent(key, now).length >= max;
    },
    recordFailure(key: string, now = Date.now()) {
      failures.set(key, [...recent(key, now), now]);
    },
    reset(key: string) {
      failures.delete(key);
    },
  };
}

export const loginThrottle = createThrottle();
