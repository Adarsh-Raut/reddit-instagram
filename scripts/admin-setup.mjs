// Usage: npm run admin:setup
// Prompts for the dashboard password (hidden), then writes ADMIN_PASSWORD_HASH to
// .env.local and creates SESSION_SECRET there if missing. The password is never printed or stored.
import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

export function hashPassword(password) {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function upsertEnv(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(content)) return content.replace(re, () => line);
  return `${content}${content === "" || content.endsWith("\n") ? "" : "\n"}${line}\n`;
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const first = await ask("New dashboard password (min 12 characters): ");
  if (first.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }
  if (first !== (await ask("Repeat password: "))) {
    console.error("Passwords don't match.");
    process.exit(1);
  }
  const path = ".env.local";
  let env = existsSync(path) ? readFileSync(path, "utf8") : "";
  env = upsertEnv(env, "ADMIN_PASSWORD_HASH", hashPassword(first));
  if (!/^SESSION_SECRET=.{32,}$/m.test(env)) {
    env = upsertEnv(env, "SESSION_SECRET", randomBytes(32).toString("base64url"));
  }
  writeFileSync(path, env);
  console.log("Saved ADMIN_PASSWORD_HASH to .env.local. Restart the dev server to apply it.");
}

import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
