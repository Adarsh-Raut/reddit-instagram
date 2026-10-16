import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const scrapedStatus = pgEnum("scraped_status", [
  "new",
  "approved",
  "rejected",
  "posted",
]);

export const scheduledStatus = pgEnum("scheduled_status", [
  "pending",
  "publishing",
  "posted",
  "failed",
]);

export const igAccounts = pgTable("ig_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  igUserId: varchar("ig_user_id", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 128 }),
  // AES-GCM encrypted long-lived token (see src/lib/crypto.ts when added)
  encryptedToken: text("encrypted_token").notNull(),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const scrapedPosts = pgTable(
  "scraped_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    redditId: varchar("reddit_id", { length: 32 }).notNull().unique(),
    subreddit: varchar("subreddit", { length: 64 }).notNull(),
    title: text("title").notNull(),
    author: varchar("author", { length: 64 }),
    permalink: text("permalink").notNull(),
    cloudinaryUrl: text("cloudinary_url").notNull(),
    cloudinaryPublicId: text("cloudinary_public_id").notNull(),
    imageHash: varchar("image_hash", { length: 64 }),
    status: scrapedStatus("status").default("new").notNull(),
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("scraped_posts_status_idx").on(t.status)],
);

export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scrapedPostId: uuid("scraped_post_id")
      .notNull()
      .references(() => scrapedPosts.id, { onDelete: "cascade" }),
    caption: text("caption").default("").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: scheduledStatus("status").default("pending").notNull(),
    igMediaId: varchar("ig_media_id", { length: 64 }),
    error: text("error"),
    attempts: integer("attempts").default(0).notNull(),
    // set when publishing starts; lets a job spot posts stuck mid-publish
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("scheduled_posts_due_idx").on(t.status, t.scheduledAt),
    // a meme is scheduled at most once, and a time slot holds at most one post
    unique("scheduled_posts_scraped_post_uniq").on(t.scrapedPostId),
    unique("scheduled_posts_time_uniq").on(t.scheduledAt),
  ],
);

// Single-row settings table (id is always 1)
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  subreddits: text("subreddits").array().default(["memes", "dankmemes"]).notNull(),
  scrapeCount: integer("scrape_count").default(15).notNull(),
  // "HH:mm" slots in the configured timezone
  postSlots: text("post_slots").array().default(["09:00", "14:00", "20:00"]).notNull(),
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  // scrape once a day automatically
  autoScrape: boolean("auto_scrape").default(true).notNull(),
  // schedule a post into the next free slot as soon as it is approved
  autoSchedule: boolean("auto_schedule").default(false).notNull(),
  autoScheduleDays: integer("auto_schedule_days").default(7).notNull(),
});
