-- Cached SearXNG results. Keyed by normalised query so "  Foo Bar " and
-- "foo bar" are one entry; the TTL is applied at read time in lib/searxng.ts
-- rather than by a sweeper, so an unused row costs nothing but disk.
CREATE TABLE IF NOT EXISTS "search_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"results" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "search_cache_fetched_at_idx" ON "search_cache" ("fetched_at");
