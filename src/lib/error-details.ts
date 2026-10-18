export type ErrorDetails = {
  /** Next's error digest: matches the entry in the server logs. Null for client-side errors. */
  reference: string | null;
  message: string;
  route: string;
  time: string;
};

const MAX_MESSAGE = 300;

/**
 * Support-friendly summary of a caught error. Boundaries receive `unknown`, so narrow first.
 * Never includes the stack trace, and production server errors only carry a generic message.
 */
export function describeError(error: unknown, route: string, now: Date = new Date()): ErrorDetails {
  const digest =
    typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const message = raw.trim().slice(0, MAX_MESSAGE) || "Unknown error";
  return { reference: digest, message, route, time: now.toISOString() };
}

export function formatErrorDetails(details: ErrorDetails): string {
  return JSON.stringify(details, null, 2);
}
