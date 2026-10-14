ALTER TABLE "google_calendar_connections"
  ADD COLUMN IF NOT EXISTS "sync_lock_until" timestamp;