CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "family_name" varchar NOT NULL REFERENCES "families"("family_name") ON DELETE CASCADE,
  "google_subject" varchar,
  "google_email" varchar,
  "access_token_encrypted" text NOT NULL,
  "refresh_token_encrypted" text NOT NULL,
  "token_expires_at" timestamp,
  "scopes" text,
  "active" boolean NOT NULL DEFAULT false,
  "sync_lock_until" timestamp,
  "sync_lock_owner" varchar,
  "last_sync_at" timestamp,
  "last_error" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_connections_family_unique" ON "google_calendar_connections" ("family_name");
CREATE TABLE IF NOT EXISTS "google_calendar_mappings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "connection_id" varchar NOT NULL REFERENCES "google_calendar_connections"("id") ON DELETE CASCADE,
  "google_calendar_id" varchar NOT NULL,
  "google_calendar_name" varchar NOT NULL,
  "member_id" varchar NOT NULL REFERENCES "family_members"("id") ON DELETE CASCADE,
  "default_points" integer NOT NULL DEFAULT 10,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_mappings_connection_calendar_unique" ON "google_calendar_mappings" ("connection_id", "google_calendar_id");
CREATE TABLE IF NOT EXISTS "google_calendar_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "connection_id" varchar NOT NULL REFERENCES "google_calendar_connections"("id") ON DELETE CASCADE,
  "mapping_id" varchar NOT NULL REFERENCES "google_calendar_mappings"("id") ON DELETE CASCADE,
  "google_calendar_id" varchar NOT NULL,
  "google_event_id" varchar NOT NULL,
  "occurrence_key" varchar NOT NULL,
  "task_id" varchar NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "google_updated_at" timestamp,
  "cancelled" boolean NOT NULL DEFAULT false,
  "task_status_before_cancellation" varchar,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_events_occurrence_unique" ON "google_calendar_events" ("connection_id", "google_calendar_id", "occurrence_key");