import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

export const cruises = sqliteTable("cruises", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sailingId: text("sailing_id").notNull().unique(),
  shipName: text("ship_name").notNull(),
  shipCode: text("ship_code").notNull(),
  departurePort: text("departure_port").notNull(),
  itineraryTitle: text("itinerary_title").notNull(),
  durationDays: integer("duration_days").notNull(),
  departureDate: text("departure_date").notNull(),
  arrivalDate: text("arrival_date").notNull(),
  interiorPrice: real("interior_price"),
  interiorSoldOut: integer("interior_sold_out", { mode: "boolean" }).notNull().default(false),
  balconyPrice: real("balcony_price"),
  balconySoldOut: integer("balcony_sold_out", { mode: "boolean" }).notNull().default(false),
  suitePrice: real("suite_price"),
  suiteSoldOut: integer("suite_sold_out", { mode: "boolean" }).notNull().default(false),
  rateCode: text("rate_code"),
  bookingUrl: text("booking_url").notNull(),
  ports: text("ports").notNull(),
  lastUpdated: text("last_updated").notNull().default(sql`(datetime('now'))`),
  favorited: integer("favorited", { mode: "boolean" }).notNull().default(false),
});

export const searchMetadata = sqliteTable("search_metadata", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lastRefresh: text("last_refresh").notNull().default(sql`(datetime('now'))`),
  totalResults: integer("total_results").notNull().default(0),
});