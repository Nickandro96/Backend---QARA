-- Additive only: creates a new table for per-user onboarding profile persistence
-- (selected referentiels, economic role, target markets, completion date).
-- Does not touch any existing table/column. Safe to run against production.

CREATE TABLE IF NOT EXISTS `onboarding_profiles` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `referentiels` json NOT NULL,
  `economicRole` enum('fabricant','mandataire','importateur','distributeur') NOT NULL,
  `markets` json NOT NULL,
  `completedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `onboarding_profiles_user_uq` UNIQUE (`userId`),
  CONSTRAINT `onboarding_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
);
