CREATE TABLE IF NOT EXISTS "device_push_tokens" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "member_id" varchar NOT NULL,
  "token" varchar(256) NOT NULL,
  "platform" varchar(16) DEFAULT 'ios' NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "device_push_tokens_member_id_token_unique" UNIQUE("member_id","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
