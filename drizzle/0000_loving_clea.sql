CREATE TYPE "public"."scheduled_status" AS ENUM('pending', 'publishing', 'posted', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scraped_status" AS ENUM('new', 'approved', 'rejected', 'posted');--> statement-breakpoint
CREATE TABLE "ig_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ig_user_id" varchar(64) NOT NULL,
	"username" varchar(128),
	"encrypted_token" text NOT NULL,
	"token_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ig_accounts_ig_user_id_unique" UNIQUE("ig_user_id")
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scraped_post_id" uuid NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "scheduled_status" DEFAULT 'pending' NOT NULL,
	"ig_media_id" varchar(64),
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_posts_scraped_post_uniq" UNIQUE("scraped_post_id"),
	CONSTRAINT "scheduled_posts_time_uniq" UNIQUE("scheduled_at")
);
--> statement-breakpoint
CREATE TABLE "scraped_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reddit_id" varchar(32) NOT NULL,
	"subreddit" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"author" varchar(64),
	"permalink" text NOT NULL,
	"cloudinary_url" text NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"image_hash" varchar(64),
	"status" "scraped_status" DEFAULT 'new' NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scraped_posts_reddit_id_unique" UNIQUE("reddit_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"subreddits" text[] DEFAULT '{"memes","dankmemes"}' NOT NULL,
	"scrape_count" integer DEFAULT 15 NOT NULL,
	"post_slots" text[] DEFAULT '{"09:00","14:00","20:00"}' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD CONSTRAINT "scheduled_posts_scraped_post_id_scraped_posts_id_fk" FOREIGN KEY ("scraped_post_id") REFERENCES "public"."scraped_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scheduled_posts_due_idx" ON "scheduled_posts" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "scraped_posts_status_idx" ON "scraped_posts" USING btree ("status");