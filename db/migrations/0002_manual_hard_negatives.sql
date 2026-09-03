CREATE TABLE "manual_pair_proposals" (
	"pair_id" text PRIMARY KEY NOT NULL,
	"created_by" text NOT NULL,
	"strategy" text NOT NULL,
	"reason" text NOT NULL,
	"evidence" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manual_pair_proposals" ADD CONSTRAINT "manual_pair_proposals_pair_id_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."pairs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "manual_pair_creator" ON "manual_pair_proposals" USING btree ("created_by","created");