ALTER TABLE "leads" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "emails" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "facebook" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "instagram" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "linkedin" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "twitter" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "enrichment_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "website_last_checked" timestamp;