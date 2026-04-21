CREATE TABLE IF NOT EXISTS "email_readiness_checks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "check_type" varchar(32) NOT NULL,
  "status" varchar(16) NOT NULL,
  "configured" boolean NOT NULL,
  "provider" varchar(64),
  "credential_source" varchar(64),
  "from_address" varchar(320) NOT NULL,
  "base_url" varchar(512),
  "expected_production_base_url" varchar(512) NOT NULL,
  "links_use_expected_domain" boolean NOT NULL,
  "production_links_use_expected_domain" boolean NOT NULL,
  "test_attempted" boolean DEFAULT false NOT NULL,
  "test_succeeded" boolean DEFAULT false NOT NULL,
  "test_recipient" varchar(320),
  "issue_summary" text,
  "issues" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "checked_at" timestamp DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_readiness_checks_checked_at_idx" ON "email_readiness_checks" ("checked_at");