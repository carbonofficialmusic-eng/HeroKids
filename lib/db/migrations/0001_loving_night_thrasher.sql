CREATE TYPE "public"."sharing_status" AS ENUM('not_shared', 'sharing_active', 'sharing_finalized');--> statement-breakpoint
CREATE TABLE "reward_sharing_participants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"redemption_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"points_contributed" integer NOT NULL,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "family_members" ALTER COLUMN "pin_code" SET DATA TYPE varchar(60);--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD COLUMN "original_points_spent" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD COLUMN "sharing_status" "sharing_status" DEFAULT 'not_shared' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "max_completions" integer;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "completion_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "reward_sharing_participants" ADD CONSTRAINT "reward_sharing_participants_redemption_id_reward_redemptions_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."reward_redemptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_sharing_participants" ADD CONSTRAINT "reward_sharing_participants_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;