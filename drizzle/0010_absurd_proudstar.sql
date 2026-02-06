CREATE TABLE IF NOT EXISTS `demo_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hasUsedDemo` boolean NOT NULL DEFAULT false,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `demo_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `demo_usage_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `demo_usage` ADD CONSTRAINT `demo_usage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `demo_user_id_idx` ON `demo_usage` (`userId`);