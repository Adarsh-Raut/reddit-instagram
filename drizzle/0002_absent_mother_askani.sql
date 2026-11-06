ALTER TABLE "scheduled_posts" ADD COLUMN "caption_provider" varchar(32);--> statement-breakpoint
ALTER TABLE "scheduled_posts" ADD COLUMN "caption_ai_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ai_captions" boolean DEFAULT true NOT NULL;