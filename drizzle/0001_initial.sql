CREATE TABLE cruises (
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
);
--> statement-breakpoint
CREATE TABLE search_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  last_refresh TEXT NOT NULL DEFAULT (datetime('now')),
  total_results INTEGER NOT NULL DEFAULT 0
);