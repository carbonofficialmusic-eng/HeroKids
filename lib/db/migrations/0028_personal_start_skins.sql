-- Nullable markers deliberately leave every existing member out of the new flow.
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS start_skin_options text[],
  ADD COLUMN IF NOT EXISTS free_starter_skin_id varchar,
  ADD COLUMN IF NOT EXISTS first_task_created_at timestamp,
  ADD COLUMN IF NOT EXISTS start_completed_at timestamp;
