ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email" varchar(320);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email_verification_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email_verification_token_expires_at" timestamp;
