ALTER TABLE "searches" ADD COLUMN "total_leads" integer DEFAULT 0;--> statement-breakpoint
CREATE INDEX "search_id_idx" ON "leads" USING btree ("search_id");