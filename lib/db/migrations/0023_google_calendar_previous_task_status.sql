ALTER TABLE "google_calendar_events"
  ADD COLUMN IF NOT EXISTS "task_status_before_cancellation" varchar;