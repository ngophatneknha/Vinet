CREATE TABLE "adjudications" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"user_id" text NOT NULL,
	"decision" text NOT NULL,
	"reason" text NOT NULL,
	"payload" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"pair_id" text NOT NULL,
	"user_id" text NOT NULL,
	"slot" integer NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"payload" text DEFAULT '{}' NOT NULL,
	"label" text,
	"difficulty" text,
	"updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher" text NOT NULL,
	"headline" text NOT NULL,
	"topic" text,
	"date" text,
	"payload" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"lease_user" text,
	"event_id" text,
	"inventory_flag" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"format" text NOT NULL,
	"ready" integer DEFAULT 0 NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"entity_id" text NOT NULL,
	"payload" text NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"guideline" text DEFAULT 'V2' NOT NULL,
	"kind" text DEFAULT 'pilot' NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"payload" text NOT NULL,
	"decision" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"email" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created" text NOT NULL,
	CONSTRAINT "members_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pairs" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"image_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"state" text DEFAULT 'open' NOT NULL,
	"final_label" text,
	"created" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"user_id" text NOT NULL,
	"state" text NOT NULL,
	"decision" text,
	"payload" text NOT NULL,
	"updated" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_pair_id_pairs_id_fk" FOREIGN KEY ("pair_id") REFERENCES "public"."pairs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pairs" ADD CONSTRAINT "pairs_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_reviews" ADD CONSTRAINT "raw_reviews_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "adjudication_entity" ON "adjudications" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pair_slot" ON "annotations" USING btree ("pair_id","slot") WHERE state != 'released';--> statement-breakpoint
CREATE UNIQUE INDEX "pair_user" ON "annotations" USING btree ("pair_id","user_id") WHERE state != 'released';--> statement-breakpoint
CREATE INDEX "annotation_user" ON "annotations" USING btree ("user_id","state");--> statement-breakpoint
CREATE INDEX "article_status" ON "articles" USING btree ("status","publisher","id");--> statement-breakpoint
CREATE INDEX "audit_time" ON "audit" USING btree ("created");--> statement-breakpoint
CREATE INDEX "image_article" ON "images" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "image_asset" ON "images" USING btree ("asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pair_content" ON "pairs" USING btree ("article_id","image_id");--> statement-breakpoint
CREATE INDEX "pair_state" ON "pairs" USING btree ("state","batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_user" ON "raw_reviews" USING btree ("article_id","user_id");