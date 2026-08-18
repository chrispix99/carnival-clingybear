import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzleBunSqlite } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";
import { Database } from "bun:sqlite";

let dbInstance: any = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  const postgresUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  // Prefer Turso/libSQL if configured — true persistence on Vercel
  if (tursoUrl && tursoToken) {
    const client = createClient({ url: tursoUrl, authToken: tursoToken });
    dbInstance = drizzleLibsql(client, { schema });
    return dbInstance;
  }

  if (tursoUrl) {
    // libSQL file or http without token
    const client = createClient({ url: tursoUrl });
    dbInstance = drizzleLibsql(client, { schema });
    return dbInstance;
  }

  // Vercel Postgres would use different driver (skip for now, fallback to sqlite file)
  // Fallback: local SQLite file at app.db (ephemeral on Vercel, persistent on Hatch)
  // On Vercel this will be /var/task/app.db which is ephemeral but still works; data re-fetched on demand
  const dbPath = process.env.SQLITE_PATH || "./app.db";
  try {
    const sqlite = new Database(dbPath);
    dbInstance = drizzleBunSqlite(sqlite, { schema });
    // Ensure tables exist (simple migration check)
    try {
      sqlite.exec(`CREATE TABLE IF NOT EXISTS cruises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sailing_id TEXT NOT NULL UNIQUE,
        ship_name TEXT NOT NULL,
        ship_code TEXT NOT NULL,
        departure_port TEXT NOT NULL,
        itinerary_title TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        departure_date TEXT NOT NULL,
        arrival_date TEXT NOT NULL,
        interior_price REAL,
        interior_sold_out INTEGER NOT NULL DEFAULT 0,
        balcony_price REAL,
        balcony_sold_out INTEGER NOT NULL DEFAULT 0,
        suite_price REAL,
        suite_sold_out INTEGER NOT NULL DEFAULT 0,
        rate_code TEXT,
        booking_url TEXT NOT NULL,
        ports TEXT NOT NULL,
        last_updated TEXT NOT NULL DEFAULT (datetime('now')),
        favorited INTEGER NOT NULL DEFAULT 0
      ); CREATE TABLE IF NOT EXISTS search_metadata (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        last_refresh TEXT NOT NULL DEFAULT (datetime('now')),
        total_results INTEGER NOT NULL DEFAULT 0
      );`);
    } catch {}
    return dbInstance;
  } catch (e) {
    // Final fallback: in-memory via libSQL
    const client = createClient({ url: "file::memory:" });
    dbInstance = drizzleLibsql(client, { schema });
    return dbInstance;
  }
}
