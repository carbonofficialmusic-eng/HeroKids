ALTER TABLE "families"
ADD COLUMN IF NOT EXISTS "child_push_quiet_enabled" boolean DEFAULT true NOT NULL;