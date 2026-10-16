import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

type Db = NodePgDatabase<typeof schema>;

let instance: Db | undefined;

function isNeon(url: string) {
  return new URL(url).hostname.endsWith(".neon.tech");
}

function create(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Neon (production) over HTTP; any other host (local Docker) over node-postgres.
  // Both expose the same Drizzle query API.
  return isNeon(url)
    ? (drizzleNeon(neon(url), { schema }) as unknown as Db)
    : drizzlePg(url, { schema });
}

/** Lazy so importing this module never fails at build time without env. */
export function getDb() {
  return (instance ??= create());
}

/** Test hook: swap in another Drizzle instance (e.g. in-memory PGlite). */
export function setDbForTests(db: unknown) {
  instance = db as Db;
}
