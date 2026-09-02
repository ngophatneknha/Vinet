CREATE TABLE `adjudications` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`user_id` text NOT NULL,
	`decision` text NOT NULL,
	`reason` text NOT NULL,
	`payload` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `adjudication_entity` ON `adjudications` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `annotations` (
	`id` text PRIMARY KEY NOT NULL,
	`pair_id` text NOT NULL,
	`user_id` text NOT NULL,
	`slot` integer NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`label` text,
	`difficulty` text,
	`updated` text NOT NULL,
	FOREIGN KEY (`pair_id`) REFERENCES `pairs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pair_slot` ON `annotations` (`pair_id`,`slot`) WHERE state != 'released';--> statement-breakpoint
CREATE UNIQUE INDEX `pair_user` ON `annotations` (`pair_id`,`user_id`) WHERE state != 'released';--> statement-breakpoint
CREATE INDEX `annotation_user` ON `annotations` (`user_id`,`state`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`publisher` text NOT NULL,
	`headline` text NOT NULL,
	`topic` text,
	`date` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`lease_user` text,
	`event_id` text,
	`inventory_flag` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `article_status` ON `articles` (`status`,`publisher`,`id`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`format` text NOT NULL,
	`ready` integer DEFAULT 0 NOT NULL,
	`bytes` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`action` text NOT NULL,
	`entity_id` text NOT NULL,
	`payload` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_time` ON `audit` (`created`);--> statement-breakpoint
CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`guideline` text DEFAULT 'V2' NOT NULL,
	`kind` text DEFAULT 'pilot' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `images` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`payload` text NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `image_article` ON `images` (`article_id`);--> statement-breakpoint
CREATE INDEX `image_asset` ON `images` (`asset_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_user_id_unique` ON `members` (`user_id`);--> statement-breakpoint
CREATE TABLE `pairs` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`image_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`state` text DEFAULT 'open' NOT NULL,
	`final_label` text,
	`created` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`image_id`) REFERENCES `images`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pair_content` ON `pairs` (`article_id`,`image_id`);--> statement-breakpoint
CREATE INDEX `pair_state` ON `pairs` (`state`,`batch_id`);--> statement-breakpoint
CREATE TABLE `raw_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`user_id` text NOT NULL,
	`state` text NOT NULL,
	`decision` text,
	`payload` text NOT NULL,
	`updated` text NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `raw_user` ON `raw_reviews` (`article_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
