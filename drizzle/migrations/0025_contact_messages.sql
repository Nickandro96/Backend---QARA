-- Additive : table pour trpc.contact.submit/list/updateStatus (formulaire de
-- contact public + panneau admin), absente jusqu'ici (voir INVENTAIRE-BUGS.md #6/#8).
CREATE TABLE IF NOT EXISTS `contact_messages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `company` varchar(255),
  `subject` varchar(100) NOT NULL,
  `message` text NOT NULL,
  `status` enum('new','read','replied','archived') NOT NULL DEFAULT 'new',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()),
  PRIMARY KEY (`id`)
);

ALTER TABLE `contact_messages`
  ADD CONSTRAINT `contact_messages_userId_users_id_fk`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
