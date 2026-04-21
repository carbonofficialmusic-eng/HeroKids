ALTER TABLE "account_link_repair_history"
ADD COLUMN IF NOT EXISTS "repaired_by" varchar(120);