import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { setDbForTests } from "./index";
import * as schema from "./schema";

/** In-memory Postgres using the real migrations, wired in as the app's DB. Tests only. */
export async function createTestDb() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  setDbForTests(db);
  return db;
}

export async function resetTestDb(db: Awaited<ReturnType<typeof createTestDb>>) {
  await db.delete(schema.scheduledPosts);
  await db.delete(schema.scrapedPosts);
  await db.delete(schema.settings);
  await db.delete(schema.igAccounts);
}
