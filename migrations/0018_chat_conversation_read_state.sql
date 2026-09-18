CREATE TABLE IF NOT EXISTS "chat_conversation_reads" (
  "member_id" varchar NOT NULL REFERENCES "family_members"("id") ON DELETE CASCADE,
  "conversation_key" varchar NOT NULL,
  "last_read_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "chat_conversation_reads_member_conversation_pk"
    PRIMARY KEY ("member_id", "conversation_key")
);