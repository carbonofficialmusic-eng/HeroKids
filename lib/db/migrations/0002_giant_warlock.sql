ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_reset_token_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;--> statement-breakpoint
WITH ranked_verified_emails AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY lower("email")
      ORDER BY "last_login_at" DESC NULLS LAST, "updated_at" DESC NULLS LAST, "created_at" DESC NULLS LAST, "id" ASC
    ) AS row_number
  FROM "users"
  WHERE "email" IS NOT NULL AND "is_email_verified" = true
)
UPDATE "users"
SET
  "is_email_verified" = false,
  "email_verification_token_hash" = NULL,
  "email_verification_token_expires_at" = NULL
WHERE "id" IN (
  SELECT "id"
  FROM ranked_verified_emails
  WHERE row_number > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_verified_email_lower_unique"
ON "users" (lower("email"))
WHERE "email" IS NOT NULL AND "is_email_verified" = true;
