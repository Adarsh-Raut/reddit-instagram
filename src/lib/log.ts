import pino, { type DestinationStream, type Logger } from "pino";
import pretty from "pino-pretty";

/** Field names whose values must never reach a log, at the top level or one level deep. */
const SECRET_KEYS = [
  "token",
  "accessToken",
  "access_token",
  "encryptedToken",
  "password",
  "secret",
  "clientSecret",
  "appSecret",
  "authorization",
  "cookie",
];

export const REDACT_PATHS = [
  ...SECRET_KEYS,
  ...SECRET_KEYS.map((k) => `*.${k}`),
  "*.headers.authorization",
  "*.headers.cookie",
];

const SECRET_KEY_RE = /token|secret|password|authorization|cookie|api[_-]?key/i;

/** Copy of `value` with the contents of any secret-looking key replaced. Used before storing metadata. */
export function redactDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[Truncated]";
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SECRET_KEY_RE.test(k) ? "[Redacted]" : redactDeep(v, depth + 1)]),
    );
  }
  return value;
}

export function buildLogger(opts: { stream?: DestinationStream; level?: string } = {}): Logger {
  const env = process.env.NODE_ENV;
  const level = opts.level ?? process.env.LOG_LEVEL ?? (env === "production" ? "info" : env === "test" ? "silent" : "debug");
  const options = {
    level,
    redact: { paths: REDACT_PATHS, censor: "[Redacted]" },
    base: { app: "reddit-instagram" },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (opts.stream) return pino(options, opts.stream);
  // Readable colored lines locally; plain JSON lines in production (searchable on the host).
  if (env === "production") return pino(options);
  return pino(
    { ...options, base: undefined },
    pretty({ colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname", sync: true }),
  );
}

const root = buildLogger();

/** Named logger, e.g. getLogger("publish"). Log errors as `log.error({ err }, "what failed")`. */
export function getLogger(module: string): Logger {
  return root.child({ module });
}
