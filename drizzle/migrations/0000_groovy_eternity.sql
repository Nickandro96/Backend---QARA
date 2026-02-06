CREATE TABLE `actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`findingId` int NOT NULL,
	`actionCode` varchar(50),
	`actionType` enum('corrective','preventive','improvement') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`responsibleName` varchar(255),
	`responsibleEmail` varchar(320),
	`priority` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`status` enum('open','in_progress','completed','verified','cancelled') NOT NULL DEFAULT 'open',
	`dueDate` timestamp,
	`completedAt` timestamp,
	`verifiedAt` timestamp,
	`effectivenessVerified` boolean DEFAULT false,
	`effectivenessNotes` text,
	`evidence` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agg_monthly_process` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`processId` int,
	`yearMonth` varchar(7) NOT NULL,
	`auditCount` int DEFAULT 0,
	`avgScore` decimal(5,2),
	`avgConformityRate` decimal(5,2),
	`ncMajorCount` int DEFAULT 0,
	`ncMinorCount` int DEFAULT 0,
	`observationCount` int DEFAULT 0,
	`ofiCount` int DEFAULT 0,
	`totalFindings` int DEFAULT 0,
	`riskScore` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agg_monthly_process_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agg_monthly_site` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`yearMonth` varchar(7) NOT NULL,
	`auditCount` int DEFAULT 0,
	`avgScore` decimal(5,2),
	`avgConformityRate` decimal(5,2),
	`ncMajorCount` int DEFAULT 0,
	`ncMinorCount` int DEFAULT 0,
	`observationCount` int DEFAULT 0,
	`ofiCount` int DEFAULT 0,
	`totalActions` int DEFAULT 0,
	`closedActions` int DEFAULT 0,
	`overdueActions` int DEFAULT 0,
	`avgClosureDays` decimal(7,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agg_monthly_site_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agg_requirement_pareto` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int,
	`referentialId` int,
	`processId` int,
	`yearMonth` varchar(7) NOT NULL,
	`ncCount` int DEFAULT 0,
	`totalAudits` int DEFAULT 0,
	`ncRate` decimal(5,2),
	`avgRiskScore` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agg_requirement_pareto_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agg_standard_clause` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`referentialId` int,
	`clause` varchar(100),
	`yearMonth` varchar(7) NOT NULL,
	`totalQuestions` int DEFAULT 0,
	`conformeCount` int DEFAULT 0,
	`nokCount` int DEFAULT 0,
	`naCount` int DEFAULT 0,
	`conformityRate` decimal(5,2),
	`ncMajorCount` int DEFAULT 0,
	`ncMinorCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agg_standard_clause_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_checklist_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`questionId` int NOT NULL,
	`answer` enum('conforme','nok','na','partial') NOT NULL,
	`score` int,
	`maxScore` int,
	`comment` text,
	`evidenceCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_checklist_answers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`userId` int NOT NULL,
	`reportType` enum('complete','executive','comparative','action_plan','evidence_index') NOT NULL,
	`reportTitle` varchar(500) NOT NULL,
	`reportVersion` varchar(50) NOT NULL DEFAULT '1.0',
	`referentialIds` text,
	`processIds` text,
	`economicRole` varchar(100),
	`market` varchar(50),
	`fileKey` varchar(500),
	`fileUrl` varchar(1000),
	`fileSize` int,
	`fileFormat` varchar(20) NOT NULL DEFAULT 'pdf',
	`metadata` text,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`generatedBy` int NOT NULL,
	`comparedAuditIds` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`response` text,
	`status` enum('conforme','nok','na') NOT NULL,
	`comment` text,
	`respondedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audit_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`name` varchar(255) NOT NULL,
	`auditType` enum('internal','external','supplier','certification','surveillance','blanc') NOT NULL DEFAULT 'internal',
	`status` enum('draft','in_progress','completed','closed') NOT NULL DEFAULT 'draft',
	`referentialIds` text,
	`processIds` text,
	`siteLocation` varchar(255),
	`clientOrganization` varchar(255),
	`auditorName` varchar(255),
	`auditorEmail` varchar(320),
	`startDate` timestamp,
	`endDate` timestamp,
	`closedAt` timestamp,
	`score` decimal(5,2),
	`conformityRate` decimal(5,2),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`badgeType` enum('audit_ready','pms_maitrisee','gspr_completes','first_audit','conformity_champion','evidence_master','sprint_achiever') NOT NULL,
	`earnedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_sprints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`targetScore` decimal(5,2) NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`processId` int,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `compliance_sprints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contact_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`company` varchar(255),
	`subject` enum('demo','support','partnership','pricing','other') NOT NULL,
	`message` text NOT NULL,
	`status` enum('new','read','replied','archived') NOT NULL DEFAULT 'new',
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contact_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `demo_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hasUsedDemo` boolean NOT NULL DEFAULT false,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `demo_usage_id` PRIMARY KEY(`id`),
	CONSTRAINT `demo_usage_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `device_classifications` (
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
--> statement-breakpoint
CREATE TABLE `evidence_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`questionId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evidence_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fda_audit_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`questionId` int NOT NULL,
	`responseValue` varchar(32),
	`responseComment` text,
	`evidenceFiles` text,
	`answeredBy` int,
	`answeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fda_audit_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_audit_responses_audit_question_idx` UNIQUE(`auditId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `fda_classifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceName` text NOT NULL,
	`deviceDescription` text,
	`intendedUse` text NOT NULL,
	`resultingClass` enum('I','II','III') NOT NULL,
	`controlLevel` enum('general','special') NOT NULL,
	`pathway` enum('exempt','510k','de_novo','pma') NOT NULL,
	`answers` text NOT NULL,
	`justification` text NOT NULL,
	`projectPlan` text,
	`requiredDocuments` text,
	`auditQuestions` text,
	`risks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fda_classifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fda_question_applicability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`roleCode` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fda_question_applicability_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_question_applicability_question_role_idx` UNIQUE(`questionId`,`roleCode`)
);
--> statement-breakpoint
CREATE TABLE `fda_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`frameworkCode` varchar(32) NOT NULL,
	`process` varchar(255),
	`subprocess` varchar(255),
	`referenceStandard` varchar(255),
	`referenceExact` varchar(255),
	`questionShort` text,
	`questionDetailed` text,
	`expectedEvidence` text,
	`interviews` text,
	`fieldTest` text,
	`riskIfNc` text,
	`criticality` varchar(32),
	`applicabilityType` enum('ALL','ROLE_BASED') NOT NULL DEFAULT 'ROLE_BASED',
	`sourceFile` varchar(255),
	`sourceRow` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fda_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_questions_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `fda_regulatory_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`category` enum('qmsr','part_820','part_807','510k','de_novo','pma','postmarket','labeling_udi','guidance') NOT NULL,
	`cfrPart` varchar(100),
	`impactLevel` enum('high','medium','low') NOT NULL,
	`affectedRoles` text,
	`affectedProcesses` text,
	`affectedDocuments` text,
	`status` enum('acte','a_venir','en_consultation') NOT NULL,
	`effectiveDate` timestamp,
	`publishedAt` timestamp NOT NULL,
	`sourceUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fda_regulatory_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fda_role_qualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`brandOnLabel` boolean NOT NULL DEFAULT false,
	`designsOrSpecifiesDevice` boolean NOT NULL DEFAULT false,
	`manufacturesOrReworks` boolean NOT NULL DEFAULT false,
	`manufacturesForThirdParty` boolean NOT NULL DEFAULT false,
	`firstImportIntoUS` boolean NOT NULL DEFAULT false,
	`distributesWithoutModification` boolean NOT NULL DEFAULT false,
	`relabelingOrRepackaging` boolean NOT NULL DEFAULT false,
	`servicing` boolean NOT NULL DEFAULT false,
	`softwareAsMedicalDevice` boolean NOT NULL DEFAULT false,
	`computedRoles` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fda_role_qualifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_role_qualifications_user_site_idx` UNIQUE(`userId`,`siteId`)
);
--> statement-breakpoint
CREATE TABLE `fda_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleCode` varchar(32) NOT NULL,
	`roleName` varchar(255) NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fda_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `fda_roles_roleCode_unique` UNIQUE(`roleCode`)
);
--> statement-breakpoint
CREATE TABLE `fda_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`deviceName` text NOT NULL,
	`submissionType` enum('510k','de_novo','pma','pma_supplement','ide') NOT NULL,
	`submissionNumber` varchar(100),
	`fdaClassification` enum('class_i','class_ii','class_iii'),
	`status` enum('planning','preparation','submitted','under_review','additional_info_requested','approved','denied') NOT NULL DEFAULT 'planning',
	`submissionDate` timestamp,
	`targetSubmissionDate` timestamp,
	`fdaReviewDeadline` timestamp,
	`approvalDate` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fda_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`questionId` int,
	`referentialId` int,
	`processId` int,
	`findingCode` varchar(50),
	`findingType` enum('nc_major','nc_minor','observation','ofi','positive') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text NOT NULL,
	`evidence` text,
	`clause` varchar(100),
	`criticality` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`riskScore` int,
	`status` enum('open','in_progress','closed','verified') NOT NULL DEFAULT 'open',
	`rootCause` text,
	`closedAt` timestamp,
	`verifiedAt` timestamp,
	`verificationNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `iso_audit_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`questionId` int NOT NULL,
	`responseValue` varchar(32),
	`responseComment` text,
	`evidenceFiles` text,
	`answeredBy` int,
	`answeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `iso_audit_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `iso_audit_responses_audit_question_idx` UNIQUE(`auditId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `iso_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`standard` enum('9001','13485') NOT NULL,
	`clause` varchar(100) NOT NULL,
	`clauseTitle` varchar(255),
	`chapter` varchar(255),
	`applicability` enum('all','manufacturers_only','service_providers') NOT NULL DEFAULT 'all',
	`questionText` text NOT NULL,
	`questionShort` text,
	`expectedEvidence` text,
	`criticality` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`riskIfNonCompliant` text,
	`guidanceNotes` text,
	`actionPlan` text,
	`processCategory` varchar(255),
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `iso_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `iso_questions_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `iso_role_qualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`targetStandards` text NOT NULL,
	`organizationType` enum('manufacturer','service_provider','both') NOT NULL DEFAULT 'manufacturer',
	`economicRole` enum('fabricant','importateur','distributeur','mandataire'),
	`processes` text,
	`certificationScope` text,
	`excludedClauses` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `iso_role_qualifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `iso_role_qualifications_user_site_idx` UNIQUE(`userId`,`siteId`)
);
--> statement-breakpoint
CREATE TABLE `mandatory_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referentialId` int NOT NULL,
	`processId` int,
	`role` enum('tous','fabricant','importateur','distributeur','manufacturer_us','specification_developer','contract_manufacturer','initial_importer') NOT NULL,
	`documentName` varchar(500) NOT NULL,
	`reference` varchar(100) NOT NULL,
	`status` enum('obligatoire','conditionnel','attendu') NOT NULL,
	`objective` text NOT NULL,
	`minimumContent` text NOT NULL,
	`auditorExpectations` text,
	`commonErrors` text,
	`linkedDocuments` text,
	`linkedQuestions` text,
	`templateUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mandatory_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mdr_audit_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`auditId` int NOT NULL,
	`questionId` int NOT NULL,
	`responseValue` varchar(32),
	`responseComment` text,
	`evidenceFiles` text,
	`answeredBy` int,
	`answeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mdr_audit_responses_id` PRIMARY KEY(`id`),
	CONSTRAINT `mdr_audit_responses_audit_question_idx` UNIQUE(`auditId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `mdr_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`externalId` varchar(64) NOT NULL,
	`article` varchar(100),
	`annexe` varchar(100),
	`chapter` varchar(255),
	`economicRole` enum('fabricant','importateur','distributeur','mandataire','tous') NOT NULL DEFAULT 'tous',
	`questionText` text NOT NULL,
	`questionShort` text,
	`expectedEvidence` text,
	`criticality` enum('critical','high','medium','low') NOT NULL DEFAULT 'medium',
	`riskIfNonCompliant` text,
	`guidanceNotes` text,
	`actionPlan` text,
	`processCategory` varchar(255),
	`displayOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mdr_questions_id` PRIMARY KEY(`id`),
	CONSTRAINT `mdr_questions_externalId_unique` UNIQUE(`externalId`)
);
--> statement-breakpoint
CREATE TABLE `mdr_role_qualifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`siteId` int,
	`economicRole` enum('fabricant','importateur','distributeur','mandataire') NOT NULL,
	`hasAuthorizedRepresentative` boolean NOT NULL DEFAULT false,
	`targetMarkets` text,
	`deviceClasses` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mdr_role_qualifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `mdr_role_qualifications_user_site_idx` UNIQUE(`userId`,`siteId`)
);
--> statement-breakpoint
CREATE TABLE `processes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`displayOrder` int NOT NULL DEFAULT 0,
	`icon` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `processes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referentialId` int NOT NULL,
	`processId` int NOT NULL,
	`article` varchar(100),
	`annexe` varchar(100),
	`economicRole` enum('fabricant','importateur','distributeur','manufacturer_us','specification_developer','contract_manufacturer','initial_importer','tous') NOT NULL,
	`businessProcess` varchar(100),
	`questionText` text NOT NULL,
	`expectedEvidence` text,
	`criticality` enum('high','medium','low') NOT NULL,
	`risks` text,
	`actionPlan` text,
	`aiPrompt` text,
	`displayOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`version` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `referentials_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `regulatory_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(500) NOT NULL,
	`content` text NOT NULL,
	`referentialId` int,
	`processId` int,
	`impactLevel` enum('high','medium','low') NOT NULL,
	`affectedRoles` text,
	`status` enum('acte','a_venir','en_consultation') NOT NULL,
	`publishedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regulatory_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`reportType` enum('complete','executive','comparative','action_plan','evidence_index') NOT NULL,
	`structure` text NOT NULL,
	`styling` text,
	`isDefault` boolean NOT NULL DEFAULT false,
	`isPublic` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `report_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`code` varchar(50),
	`address` text,
	`country` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_document_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`documentId` int NOT NULL,
	`status` enum('manquant','a_mettre_a_jour','conforme') NOT NULL DEFAULT 'manquant',
	`lastReviewDate` timestamp,
	`notes` text,
	`fileUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_document_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`economicRole` enum('fabricant','importateur','distributeur','manufacturer_us','specification_developer','contract_manufacturer','initial_importer'),
	`companyName` varchar(255),
	`subscriptionTier` enum('free','pro','expert','entreprise') NOT NULL DEFAULT 'free',
	`subscriptionStatus` enum('active','canceled','past_due','trialing') DEFAULT 'active',
	`subscriptionStartDate` timestamp,
	`subscriptionEndDate` timestamp,
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
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
ALTER TABLE `actions` ADD CONSTRAINT `actions_findingId_findings_id_fk` FOREIGN KEY (`findingId`) REFERENCES `findings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_monthly_process` ADD CONSTRAINT `agg_monthly_process_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_monthly_process` ADD CONSTRAINT `agg_monthly_process_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_monthly_site` ADD CONSTRAINT `agg_monthly_site_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_monthly_site` ADD CONSTRAINT `agg_monthly_site_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_requirement_pareto` ADD CONSTRAINT `agg_requirement_pareto_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_requirement_pareto` ADD CONSTRAINT `agg_requirement_pareto_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_requirement_pareto` ADD CONSTRAINT `agg_requirement_pareto_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_requirement_pareto` ADD CONSTRAINT `agg_requirement_pareto_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_standard_clause` ADD CONSTRAINT `agg_standard_clause_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agg_standard_clause` ADD CONSTRAINT `agg_standard_clause_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_checklist_answers` ADD CONSTRAINT `audit_checklist_answers_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_checklist_answers` ADD CONSTRAINT `audit_checklist_answers_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_reports` ADD CONSTRAINT `audit_reports_generatedBy_users_id_fk` FOREIGN KEY (`generatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_responses` ADD CONSTRAINT `audit_responses_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audits` ADD CONSTRAINT `audits_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audits` ADD CONSTRAINT `audits_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `badges` ADD CONSTRAINT `badges_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `compliance_sprints` ADD CONSTRAINT `compliance_sprints_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `compliance_sprints` ADD CONSTRAINT `compliance_sprints_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contact_messages` ADD CONSTRAINT `contact_messages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `demo_usage` ADD CONSTRAINT `demo_usage_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_files` ADD CONSTRAINT `evidence_files_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `evidence_files` ADD CONSTRAINT `evidence_files_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_audit_responses` ADD CONSTRAINT `fda_audit_responses_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_audit_responses` ADD CONSTRAINT `fda_audit_responses_questionId_fda_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `fda_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_audit_responses` ADD CONSTRAINT `fda_audit_responses_answeredBy_users_id_fk` FOREIGN KEY (`answeredBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_classifications` ADD CONSTRAINT `fda_classifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_question_applicability` ADD CONSTRAINT `fda_question_applicability_questionId_fda_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `fda_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_role_qualifications` ADD CONSTRAINT `fda_role_qualifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_role_qualifications` ADD CONSTRAINT `fda_role_qualifications_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fda_submissions` ADD CONSTRAINT `fda_submissions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_questionId_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `questions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `findings` ADD CONSTRAINT `findings_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `iso_audit_responses` ADD CONSTRAINT `iso_audit_responses_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `iso_audit_responses` ADD CONSTRAINT `iso_audit_responses_questionId_iso_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `iso_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `iso_audit_responses` ADD CONSTRAINT `iso_audit_responses_answeredBy_users_id_fk` FOREIGN KEY (`answeredBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `iso_role_qualifications` ADD CONSTRAINT `iso_role_qualifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `iso_role_qualifications` ADD CONSTRAINT `iso_role_qualifications_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mandatory_documents` ADD CONSTRAINT `mandatory_documents_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mandatory_documents` ADD CONSTRAINT `mandatory_documents_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_audit_responses` ADD CONSTRAINT `mdr_audit_responses_auditId_audits_id_fk` FOREIGN KEY (`auditId`) REFERENCES `audits`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_audit_responses` ADD CONSTRAINT `mdr_audit_responses_questionId_mdr_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `mdr_questions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_audit_responses` ADD CONSTRAINT `mdr_audit_responses_answeredBy_users_id_fk` FOREIGN KEY (`answeredBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_role_qualifications` ADD CONSTRAINT `mdr_role_qualifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mdr_role_qualifications` ADD CONSTRAINT `mdr_role_qualifications_siteId_sites_id_fk` FOREIGN KEY (`siteId`) REFERENCES `sites`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `questions` ADD CONSTRAINT `questions_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_updates` ADD CONSTRAINT `regulatory_updates_referentialId_referentials_id_fk` FOREIGN KEY (`referentialId`) REFERENCES `referentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `regulatory_updates` ADD CONSTRAINT `regulatory_updates_processId_processes_id_fk` FOREIGN KEY (`processId`) REFERENCES `processes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_templates` ADD CONSTRAINT `report_templates_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sites` ADD CONSTRAINT `sites_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_document_status` ADD CONSTRAINT `user_document_status_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_document_status` ADD CONSTRAINT `user_document_status_documentId_mandatory_documents_id_fk` FOREIGN KEY (`documentId`) REFERENCES `mandatory_documents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD CONSTRAINT `user_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `watch_alert_preferences` ADD CONSTRAINT `watch_alert_preferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `action_finding_idx` ON `actions` (`findingId`);--> statement-breakpoint
CREATE INDEX `action_status_idx` ON `actions` (`status`);--> statement-breakpoint
CREATE INDEX `action_due_date_idx` ON `actions` (`dueDate`);--> statement-breakpoint
CREATE INDEX `action_priority_idx` ON `actions` (`priority`);--> statement-breakpoint
CREATE INDEX `agg_process_user_ym_idx` ON `agg_monthly_process` (`userId`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `agg_process_process_idx` ON `agg_monthly_process` (`processId`);--> statement-breakpoint
CREATE INDEX `agg_site_user_ym_idx` ON `agg_monthly_site` (`userId`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `agg_site_site_idx` ON `agg_monthly_site` (`siteId`);--> statement-breakpoint
CREATE INDEX `agg_pareto_user_ym_idx` ON `agg_requirement_pareto` (`userId`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `agg_pareto_nc_idx` ON `agg_requirement_pareto` (`ncCount`);--> statement-breakpoint
CREATE INDEX `agg_clause_user_ym_idx` ON `agg_standard_clause` (`userId`,`yearMonth`);--> statement-breakpoint
CREATE INDEX `agg_clause_ref_idx` ON `agg_standard_clause` (`referentialId`);--> statement-breakpoint
CREATE INDEX `checklist_audit_question_idx` ON `audit_checklist_answers` (`auditId`,`questionId`);--> statement-breakpoint
CREATE INDEX `checklist_answer_idx` ON `audit_checklist_answers` (`answer`);--> statement-breakpoint
CREATE INDEX `audit_reports_audit_idx` ON `audit_reports` (`auditId`);--> statement-breakpoint
CREATE INDEX `audit_reports_user_idx` ON `audit_reports` (`userId`);--> statement-breakpoint
CREATE INDEX `audit_reports_generated_at_idx` ON `audit_reports` (`generatedAt`);--> statement-breakpoint
CREATE INDEX `user_question_idx` ON `audit_responses` (`userId`,`questionId`);--> statement-breakpoint
CREATE INDEX `audit_user_idx` ON `audits` (`userId`);--> statement-breakpoint
CREATE INDEX `audit_site_idx` ON `audits` (`siteId`);--> statement-breakpoint
CREATE INDEX `audit_status_idx` ON `audits` (`status`);--> statement-breakpoint
CREATE INDEX `audit_start_date_idx` ON `audits` (`startDate`);--> statement-breakpoint
CREATE INDEX `user_badge_idx` ON `badges` (`userId`,`badgeType`);--> statement-breakpoint
CREATE INDEX `user_sprint_idx` ON `compliance_sprints` (`userId`);--> statement-breakpoint
CREATE INDEX `contact_status_idx` ON `contact_messages` (`status`);--> statement-breakpoint
CREATE INDEX `contact_created_idx` ON `contact_messages` (`createdAt`);--> statement-breakpoint
CREATE INDEX `demo_user_id_idx` ON `demo_usage` (`userId`);--> statement-breakpoint
CREATE INDEX `evidence_user_question_idx` ON `evidence_files` (`userId`,`questionId`);--> statement-breakpoint
CREATE INDEX `fda_audit_responses_audit_idx` ON `fda_audit_responses` (`auditId`);--> statement-breakpoint
CREATE INDEX `fda_audit_responses_question_idx` ON `fda_audit_responses` (`questionId`);--> statement-breakpoint
CREATE INDEX `fda_user_idx` ON `fda_classifications` (`userId`);--> statement-breakpoint
CREATE INDEX `fda_question_applicability_role_idx` ON `fda_question_applicability` (`roleCode`);--> statement-breakpoint
CREATE INDEX `fda_questions_framework_idx` ON `fda_questions` (`frameworkCode`);--> statement-breakpoint
CREATE INDEX `fda_questions_external_id_idx` ON `fda_questions` (`externalId`);--> statement-breakpoint
CREATE INDEX `fda_questions_applicability_idx` ON `fda_questions` (`applicabilityType`);--> statement-breakpoint
CREATE INDEX `fda_published_idx` ON `fda_regulatory_updates` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `fda_category_idx` ON `fda_regulatory_updates` (`category`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `fda_submissions` (`userId`);--> statement-breakpoint
CREATE INDEX `finding_audit_idx` ON `findings` (`auditId`);--> statement-breakpoint
CREATE INDEX `finding_type_idx` ON `findings` (`findingType`);--> statement-breakpoint
CREATE INDEX `finding_status_idx` ON `findings` (`status`);--> statement-breakpoint
CREATE INDEX `finding_criticality_idx` ON `findings` (`criticality`);--> statement-breakpoint
CREATE INDEX `iso_audit_responses_audit_idx` ON `iso_audit_responses` (`auditId`);--> statement-breakpoint
CREATE INDEX `iso_audit_responses_question_idx` ON `iso_audit_responses` (`questionId`);--> statement-breakpoint
CREATE INDEX `iso_questions_external_id_idx` ON `iso_questions` (`externalId`);--> statement-breakpoint
CREATE INDEX `iso_questions_standard_idx` ON `iso_questions` (`standard`);--> statement-breakpoint
CREATE INDEX `iso_questions_clause_idx` ON `iso_questions` (`clause`);--> statement-breakpoint
CREATE INDEX `iso_questions_criticality_idx` ON `iso_questions` (`criticality`);--> statement-breakpoint
CREATE INDEX `referential_idx` ON `mandatory_documents` (`referentialId`);--> statement-breakpoint
CREATE INDEX `process_idx` ON `mandatory_documents` (`processId`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `mandatory_documents` (`role`);--> statement-breakpoint
CREATE INDEX `mdr_audit_responses_audit_idx` ON `mdr_audit_responses` (`auditId`);--> statement-breakpoint
CREATE INDEX `mdr_audit_responses_question_idx` ON `mdr_audit_responses` (`questionId`);--> statement-breakpoint
CREATE INDEX `mdr_questions_external_id_idx` ON `mdr_questions` (`externalId`);--> statement-breakpoint
CREATE INDEX `mdr_questions_role_idx` ON `mdr_questions` (`economicRole`);--> statement-breakpoint
CREATE INDEX `mdr_questions_article_idx` ON `mdr_questions` (`article`);--> statement-breakpoint
CREATE INDEX `mdr_questions_criticality_idx` ON `mdr_questions` (`criticality`);--> statement-breakpoint
CREATE INDEX `mdr_role_qualifications_role_idx` ON `mdr_role_qualifications` (`economicRole`);--> statement-breakpoint
CREATE INDEX `referential_idx` ON `questions` (`referentialId`);--> statement-breakpoint
CREATE INDEX `process_idx` ON `questions` (`processId`);--> statement-breakpoint
CREATE INDEX `role_idx` ON `questions` (`economicRole`);--> statement-breakpoint
CREATE INDEX `published_idx` ON `regulatory_updates` (`publishedAt`);--> statement-breakpoint
CREATE INDEX `report_templates_user_idx` ON `report_templates` (`userId`);--> statement-breakpoint
CREATE INDEX `report_templates_type_idx` ON `report_templates` (`reportType`);--> statement-breakpoint
CREATE INDEX `site_user_idx` ON `sites` (`userId`);--> statement-breakpoint
CREATE INDEX `user_doc_idx` ON `user_document_status` (`userId`,`documentId`);--> statement-breakpoint
CREATE INDEX `user_id_idx` ON `user_profiles` (`userId`);--> statement-breakpoint
CREATE INDEX `watch_alert_user_idx` ON `watch_alert_preferences` (`userId`);