ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
