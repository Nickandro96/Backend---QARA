CREATE TABLE IF NOT EXISTS `iso_qualifications` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `userId` INT NOT NULL,
  `targetStandards` JSON NULL,
  `organizationType` VARCHAR(50) NULL,
  `economicRole` VARCHAR(50) NULL,
  `processes` JSON NULL,
  `certificationScope` TEXT NULL,
  `excludedClauses` JSON NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `iso_qualifications_user_uq` (`userId`),
  CONSTRAINT `iso_qualifications_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);
