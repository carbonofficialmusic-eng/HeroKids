CREATE TYPE "public"."age_group" AS ENUM('6-11', '11-17', 'adult');--> statement-breakpoint
ALTER TABLE "family_members" ALTER COLUMN "pin_code" SET DATA TYPE varchar(60);--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "age_group" "age_group" DEFAULT '6-11' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "max_completions" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "completion_count" integer DEFAULT 0 NOT NULL;