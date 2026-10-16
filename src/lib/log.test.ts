import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { buildLogger, redactDeep } from "./log";

function capture() {
  const lines: Record<string, unknown>[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(JSON.parse(String(chunk)));
      cb();
    },
  });
  return { lines, logger: buildLogger({ stream, level: "debug" }) };
}

describe("logger redaction", () => {
  it("never writes secrets, at the top level or nested", () => {
    const { lines, logger } = capture();
    logger.info(
      {
        token: "TOP-SECRET-1",
        access_token: "TOP-SECRET-2",
        user: { password: "TOP-SECRET-3", appSecret: "TOP-SECRET-4", name: "bob" },
        req: { headers: { authorization: "Bearer TOP-SECRET-5", cookie: "session=TOP-SECRET-6", accept: "json" } },
      },
      "hello",
    );
    const out = JSON.stringify(lines[0]);
    expect(out).not.toContain("TOP-SECRET");
    expect(out).toContain("[Redacted]");
    expect(out).toContain("bob");
    expect(out).toContain("json");
  });

  it("serializes errors with their stack", () => {
    const { lines, logger } = capture();
    logger.error({ err: new Error("boom") }, "failed");
    expect(lines[0]).toMatchObject({ level: 50, msg: "failed" });
    expect((lines[0].err as { message: string; stack: string }).message).toBe("boom");
    expect((lines[0].err as { stack: string }).stack).toContain("Error: boom");
  });

  it("respects the level", () => {
    const quiet = capture();
    const silent = buildLogger({ stream: new Writable({ write: (_c, _e, cb) => (quiet.lines.push({}), cb()) }), level: "silent" });
    silent.error("hidden");
    expect(quiet.lines).toHaveLength(0);
    const { lines, logger } = capture();
    logger.debug("shown");
    expect(lines).toHaveLength(1);
  });
});

describe("redactDeep", () => {
  it("replaces secret-looking keys at any depth and keeps the rest", () => {
    const r = redactDeep({
      id: 1,
      accessToken: "a",
      nested: { client_secret: "b", list: [{ Authorization: "c", ok: true }], when: new Date("2026-01-01") },
    }) as Record<string, unknown>;
    expect(JSON.stringify(r)).not.toMatch(/"[abc]"/);
    expect(r).toMatchObject({ id: 1, accessToken: "[Redacted]" });
    expect((r.nested as { when: Date }).when).toBeInstanceOf(Date);
    expect((r.nested as { list: { ok: boolean }[] }).list[0].ok).toBe(true);
  });

  it("stops at a sane depth", () => {
    let deep: Record<string, unknown> = { end: 1 };
    for (let i = 0; i < 20; i++) deep = { child: deep };
    expect(JSON.stringify(redactDeep(deep))).toContain("[Truncated]");
  });
});
