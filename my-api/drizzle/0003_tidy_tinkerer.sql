ALTER TABLE "searches" ADD COLUMN "scraped_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "inserted_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "duplicate_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "searches" ADD COLUMN "enriched_count" integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX "website_idx" ON "leads" USING btree ("website");--> statement-breakpoint
CREATE INDEX "phone_idx" ON "leads" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "email_idx" ON "leads" USING btree ("email");