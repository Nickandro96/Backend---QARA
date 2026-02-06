CREATE TABLE IF NOT EXISTS `device_classifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceName` text NOT NULL,
	`deviceDescription` text,
	`resultingClass` varchar(10) NOT NULL,
	`appliedRules` text NOT NULL,
	`answers` text NOT NULL,
	`justification` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `device_classifications_id` PRIMARY KEY(`id`)
);
