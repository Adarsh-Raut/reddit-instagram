import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let instance: ReturnType<typeof create> | undefined;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

/** Lazy so importing this module never fails at build time without env. */
export function getDb() {
  return (instance ??= create());
}

/** Test hook: swap in another Drizzle instance (e.g. in-memory PGlite). */
export function setDbForTests(db: unknown) {
  instance = db as ReturnType<typeof create>;
}
