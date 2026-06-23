import { pgTable, uuid, text, timestamp, real, integer, index, jsonb, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  lastUsedAt: timestamp("last_used_at"),
  lastSearchAt: timestamp("last_search_at"),
  requestsToday: integer("requests_today").default(0).notNull(),
  lastRequestAt: timestamp("last_request_at"),
  isActive: boolean("is_active").default(true).notNull(),
  totalSearches: integer("total_searches").default(0).notNull(),
  totalLeadsScraped: integer("total_leads_scraped").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiUsageLogs = pgTable("api_usage_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  apiKeyId: uuid("api_key_id")
    .references(() => apiKeys.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  statusCode: integer("status_code").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const searches = pgTable("searches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "cascade" }),
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
  emailSource: text("email_source"),
  socialSource: text("social_source"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("search_id_idx").on(table.searchId),
  index("website_idx").on(table.website),
  index("phone_idx").on(table.phone),
  index("email_idx").on(table.email),
]);

export const enrichmentJobs = pgTable("enrichment_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status").notNull().default("pending"), // pending, running, completed, failed, cancelled
  progress: integer("progress").default(0),
  totalLeads: integer("total_leads").default(0),
  completedLeads: integer("completed_leads").default(0),
  failedLeads: integer("failed_leads").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiUsageLog = typeof apiUsageLogs.$inferSelect;
export type NewApiUsageLog = typeof apiUsageLogs.$inferInsert;
export type Search = typeof searches.$inferSelect;
export type NewSearch = typeof searches.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type EnrichmentJob = typeof enrichmentJobs.$inferSelect;
export type NewEnrichmentJob = typeof enrichmentJobs.$inferInsert;

