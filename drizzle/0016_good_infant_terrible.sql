CREATE TABLE `watch_alert_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailEnabled` boolean NOT NULL DEFAULT true,
	`minImpactLevel` enum('high','medium','low') NOT NULL DEFAULT 'medium',
	`regions` text NOT NULL,
	`referentialIds` text,
	`processIds` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `watch_alert_preferences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `watch_alert_preferences` ADD CONSTRAINT `watch_alert_preferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `watch_alert_user_idx` ON `watch_alert_preferences` (`userId`);