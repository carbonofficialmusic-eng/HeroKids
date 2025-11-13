CREATE TYPE "public"."completion_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."recurrence" AS ENUM('none', 'daily', 'weekly', 'monthly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('parent', 'child');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'family', 'family_plus', 'family_hero');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('active', 'completed', 'archived');--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_name" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "families" (
	"family_name" varchar PRIMARY KEY NOT NULL,
	"join_code" varchar(6) NOT NULL,
	"subscription_tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"subscription_status" "subscription_status" DEFAULT 'active',
	"billing_customer_id" varchar,
	"billing_subscription_id" varchar,
	"tier_expires_at" timestamp,
	"show_leaderboard" boolean DEFAULT true NOT NULL,
	"single_device_mode" boolean DEFAULT false NOT NULL,
	"language" varchar(2) DEFAULT 'en' NOT NULL,
	"weekly_prize" text,
	"monthly_prize" text,
	"yearly_prize" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "families_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"family_name" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"role" "role" DEFAULT 'child' NOT NULL,
	"avatar_url" varchar,
	"color" varchar DEFAULT '#8B5CF6' NOT NULL,
	"pin_code" varchar(4),
	"total_earned" integer DEFAULT 0 NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"weekly_points" integer DEFAULT 0 NOT NULL,
	"monthly_points" integer DEFAULT 0 NOT NULL,
	"rewards_redeemed" integer DEFAULT 0 NOT NULL,
	"unlocked_skins" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"discovered_skin_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"active_skin_id" varchar,
	"last_read_chat_at" timestamp,
	"exclude_from_leaderboard" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "points_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" varchar NOT NULL,
	"points" integer NOT NULL,
	"reason" varchar NOT NULL,
	"task_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reward_redemptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reward_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"points_spent" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"redeemed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reward_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_name" varchar NOT NULL,
	"requested_by" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"point_threshold" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_name" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"point_threshold" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skins" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"image_url" varchar NOT NULL,
	"points_required" integer NOT NULL,
	"bonus_points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_completions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"proof_photo_url" varchar,
	"points_earned" integer NOT NULL,
	"status" "completion_status" DEFAULT 'pending' NOT NULL,
	"approved_by" varchar,
	"approved_at" timestamp,
	"rejection_reason" text,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_name" varchar NOT NULL,
	"created_by" varchar NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"points" integer DEFAULT 10 NOT NULL,
	"due_date" timestamp,
	"recurrence" "recurrence" DEFAULT 'none' NOT NULL,
	"recurrence_days" integer,
	"next_available_date" timestamp,
	"status" "task_status" DEFAULT 'active' NOT NULL,
	"requires_proof" boolean DEFAULT false NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"icon_emoji" varchar DEFAULT '⭐',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_family_name_families_family_name_fk" FOREIGN KEY ("family_name") REFERENCES "public"."families"("family_name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_name_families_family_name_fk" FOREIGN KEY ("family_name") REFERENCES "public"."families"("family_name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_history" ADD CONSTRAINT "points_history_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_history" ADD CONSTRAINT "points_history_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_redemptions" ADD CONSTRAINT "reward_redemptions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_requests" ADD CONSTRAINT "reward_requests_requested_by_family_members_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_requests" ADD CONSTRAINT "reward_requests_reviewed_by_family_members_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."family_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_approved_by_family_members_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_family_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."family_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");