CREATE TABLE `account` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`feature` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_usage_user` ON `ai_usage` (`user_id`);--> statement-breakpoint
CREATE TABLE `alert_hit` (
	`id` text PRIMARY KEY NOT NULL,
	`alert_id` text NOT NULL,
	`date` text NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`carrier` text NOT NULL,
	`program_id` text NOT NULL,
	`cabin` text NOT NULL,
	`miles` integer NOT NULL,
	`taxes_usd` real NOT NULL,
	`seats` integer NOT NULL,
	`found_at` text NOT NULL,
	`seen` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`alert_id`) REFERENCES `alert`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `alert_hit_alert` ON `alert_hit` (`alert_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `alert_hit_dedupe` ON `alert_hit` (`alert_id`,`date`,`carrier`,`program_id`,`cabin`);--> statement-breakpoint
CREATE TABLE `alert` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`origins` text NOT NULL,
	`destinations` text NOT NULL,
	`date_from` text NOT NULL,
	`date_to` text NOT NULL,
	`cabin` text NOT NULL,
	`passengers` integer DEFAULT 1 NOT NULL,
	`max_miles` integer,
	`programs` text,
	`channels` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`hit_count` integer DEFAULT 0 NOT NULL,
	`last_checked_at` text,
	`last_hit_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `alert_user` ON `alert` (`user_id`);--> statement-breakpoint
CREATE INDEX `alert_active` ON `alert` (`active`);--> statement-breakpoint
CREATE TABLE `availability_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`origin` text NOT NULL,
	`destination` text NOT NULL,
	`date` text NOT NULL,
	`cabin` text NOT NULL,
	`program_id` text NOT NULL,
	`carrier` text NOT NULL,
	`miles` integer NOT NULL,
	`taxes_usd` real NOT NULL,
	`seats` integer NOT NULL,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `snap_route_date` ON `availability_snapshot` (`origin`,`destination`,`date`);--> statement-breakpoint
CREATE INDEX `snap_fetched` ON `availability_snapshot` (`fetched_at`);--> statement-breakpoint
CREATE TABLE `balance` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`program_id` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`status` text,
	`expires_at` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `balance_user_program` ON `balance` (`user_id`,`program_id`);--> statement-breakpoint
CREATE TABLE `find_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`find_id` text NOT NULL,
	`user_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`find_id`) REFERENCES `find`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `find_comment_find` ON `find_comment` (`find_id`);--> statement-breakpoint
CREATE TABLE `find_like` (
	`find_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`find_id`, `user_id`),
	FOREIGN KEY (`find_id`) REFERENCES `find`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `find` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`origin` text,
	`destination` text,
	`carrier` text,
	`cabin` text,
	`program_id` text,
	`miles` integer,
	`taxes_usd` real,
	`cpp` real,
	`travel_date` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`like_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `find_created` ON `find` (`created_at`);--> statement-breakpoint
CREATE INDEX `find_user` ON `find` (`user_id`);--> statement-breakpoint
CREATE TABLE `follow` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`href` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_user` ON `notification` (`user_id`,`read`);--> statement-breakpoint
CREATE TABLE `profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`display_name` text NOT NULL,
	`bio` text DEFAULT '',
	`home_airport` text,
	`avatar_seed` text NOT NULL,
	`plan` text DEFAULT 'free' NOT NULL,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan_renews_at` text,
	`preferences` text DEFAULT '{}',
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_handle_unique` ON `profile` (`handle`);--> statement-breakpoint
CREATE TABLE `saved_search` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`query` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_search_user` ON `saved_search` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transfer_bonus` (
	`id` text PRIMARY KEY NOT NULL,
	`from_program_id` text NOT NULL,
	`to_program_id` text NOT NULL,
	`percent` integer NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text NOT NULL,
	`verified_at` text NOT NULL,
	`note` text
);
--> statement-breakpoint
CREATE INDEX `bonus_pair` ON `transfer_bonus` (`from_program_id`,`to_program_id`);--> statement-breakpoint
CREATE TABLE `trip` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '',
	`items` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trip_user` ON `trip` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text,
	`emailVerified` integer,
	`image` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verificationToken` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
