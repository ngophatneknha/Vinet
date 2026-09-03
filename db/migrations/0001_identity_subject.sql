ALTER TABLE "members" ADD COLUMN "auth_subject" text;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_auth_subject_unique" UNIQUE("auth_subject");
--> statement-breakpoint
UPDATE "members" SET "auth_subject" = "user_id" WHERE "user_id" IS NOT NULL;
