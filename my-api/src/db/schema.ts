import { pgTable, uuid, text, timestamp, real, integer, index, jsonb } from "drizzle-orm/pg-core";

export const searches = pgTable("searches", {
  id: uuid("id").defaultRandom().primaryKey(),
  keyword: text("keyword").notNull(),
  location: text("location").notNull(),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed
  totalLeads: integer("total_leads").default(0),
  scrapedCount: integer("scraped_count").default(0),
  insertedCount: integer("inserted_count").default(0),
  duplicateCount: integer("duplicate_count").default(0),
  enrichedCount: integer("enriched_count").default(0),
  progress: integer("progress").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  searchId: uuid("search_id")
    .references(() => searches.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  website: text("website"),
  address: text("address"),
  rating: real("rating"),
  reviews: integer("reviews"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  email: text("email"),
  emails: jsonb("emails").default([]),
  facebook: text("facebook"),
  instagram: text("instagram"),
  linkedin: text("linkedin"),
  twitter: text("twitter"),
  enrichmentStatus: text("enrichment_status").default("pending"),
  websiteLastChecked: timestamp("website_last_checked"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("search_id_idx").on(table.searchId),
  index("website_idx").on(table.website),
  index("phone_idx").on(table.phone),
  index("email_idx").on(table.email),
]);
export type Search = typeof searches.$inferSelect;
export type NewSearch = typeof searches.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
