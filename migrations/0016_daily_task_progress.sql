ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "daily_target" integer DEFAULT 1 NOT NULL;
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_daily_target_check";
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_daily_target_check" CHECK ("daily_target" BETWEEN 1 AND 3);

CREATE TABLE IF NOT EXISTS "daily_task_progress" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "task_id" varchar NOT NULL REFERENCES "tasks"("id") ON DELETE cascade,
  "member_id" varchar NOT NULL REFERENCES "family_members"("id") ON DELETE cascade,
  "local_date" varchar(10) NOT NULL,
  "execution_count" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "daily_task_progress_task_member_date_unique"
  ON "daily_task_progress" ("task_id", "member_id", "local_date");