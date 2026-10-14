CREATE TABLE IF NOT EXISTS "auth_rate_limits" (
  "key" varchar(512) PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "reset_time" timestamp NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_rate_limits_reset_time_idx" ON "auth_rate_limits" ("reset_time");
