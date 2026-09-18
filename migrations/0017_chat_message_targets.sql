ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "target_member_id" varchar;

ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "is_targeted" boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  ALTER TABLE "chat_messages"
    ADD CONSTRAINT "chat_messages_target_member_id_family_members_id_fk"
    FOREIGN KEY ("target_member_id") REFERENCES "family_members"("id") ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "chat_messages_target_created_at_idx"
  ON "chat_messages" ("target_member_id", "created_at");