ALTER TYPE "public"."notification_type" ADD VALUE 'pinboard_posted';--> statement-breakpoint
CREATE TABLE "pinboard_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_name" varchar NOT NULL,
	"member_id" varchar NOT NULL,
	"message" varchar(150) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "families" ADD COLUMN "category_names" jsonb;--> statement-breakpoint
ALTER TABLE "pinboard_notes" ADD CONSTRAINT "pinboard_notes_family_name_families_family_name_fk" FOREIGN KEY ("family_name") REFERENCES "public"."families"("family_name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pinboard_notes" ADD CONSTRAINT "pinboard_notes_member_id_family_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."family_members"("id") ON DELETE cascade ON UPDATE no action;