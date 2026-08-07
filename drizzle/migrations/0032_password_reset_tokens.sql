Exit code: 0
Wall time: 1.9 seconds
Output:
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `tokenHash` varchar(64) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `usedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `password_reset_tokens_hash_uq` (`tokenHash`),
  KEY `password_reset_tokens_user_idx` (`userId`),
  CONSTRAINT `password_reset_tokens_user_fk`
    FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
);

