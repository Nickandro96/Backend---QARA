-- Plan d'action CAPA (Lot 3, voir SPEC-2 et docs/audit/09-plan-action-capa.md).
-- Distinct des tables `findings`/`actions` existantes (génériques, liées au
-- flux FDA) : ici le plan d'action est généré depuis les écarts du moteur de
-- scoring, scopé par auditId+questionKey.
CREATE TABLE IF NOT EXISTS `capa_actions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `auditId` int NOT NULL,
  `questionKey` varchar(255) NOT NULL,
  `referentialCode` varchar(50) NOT NULL,
  `processName` varchar(255) NULL,
  `gravite` enum('majeur','mineur','observation') NOT NULL,
  `criticality` varchar(50) NOT NULL,
  `ecartIdentifie` text NOT NULL,
  `analyseCauseRacine` text NULL,
  `actionRecommandee` text NOT NULL,
  `actionRetenue` text NULL,
  `responsible` varchar(255) NULL,
  `dueDate` timestamp NULL,
  `statut` enum('ouverte','en_cours','a_verifier','cloturee_efficace','cloturee_inefficace','cloturee_sans_suite') NOT NULL DEFAULT 'ouverte',
  `preuveRealisation` text NULL,
  `dateVerificationEfficacite` timestamp NULL,
  `preuveEfficacite` text NULL,
  `resultatEfficacite` enum('efficace','inefficace') NULL,
  `referentielsImpactes` json NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `capa_action_unq` (`userId`, `auditId`, `questionKey`),
  KEY `capa_actions_auditId_idx` (`auditId`),
  CONSTRAINT `capa_actions_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`),
  CONSTRAINT `capa_actions_auditId_fk` FOREIGN KEY (`auditId`) REFERENCES `audits` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historique immuable des modifications (traçabilité, §8 SPEC-2) : aucune
-- suppression/mise à jour, uniquement des insertions.
CREATE TABLE IF NOT EXISTS `capa_action_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `actionId` int NOT NULL,
  `userId` int NOT NULL,
  `changedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `champ` varchar(100) NOT NULL,
  `ancienneValeur` text NULL,
  `nouvelleValeur` text NULL,
  PRIMARY KEY (`id`),
  KEY `capa_action_history_actionId_idx` (`actionId`),
  CONSTRAINT `capa_action_history_actionId_fk` FOREIGN KEY (`actionId`) REFERENCES `capa_actions` (`id`),
  CONSTRAINT `capa_action_history_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
