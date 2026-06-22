ALTER TABLE "searches" ADD COLUMN "progress" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "started_at" timestamp;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "completed_at" timestamp;