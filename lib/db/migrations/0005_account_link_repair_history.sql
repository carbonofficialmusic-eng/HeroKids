CREATE TABLE IF NOT EXISTS "account_link_repair_history" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "family_name" varchar NOT NULL REFERENCES "families"("family_name") ON DELETE cascade,
  "member_id" varchar REFERENCES "family_members"("id") ON DELETE set null,
  "member_display_name" varchar NOT NULL,
  "action" varchar(32) NOT NULL,
  "old_account_id" varchar REFERENCES "users"("id") ON DELETE set null,
  "old_account_email" varchar(320),
  "new_account_id" varchar REFERENCES "users"("id") ON DELETE set null,
  "new_account_email" varchar(320),
  "repaired_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_link_repair_history_family_repaired_idx" ON "account_link_repair_history" ("family_name", "repaired_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_link_repair_history_member_idx" ON "account_link_repair_history" ("member_id");