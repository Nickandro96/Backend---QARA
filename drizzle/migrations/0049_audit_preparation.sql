ALTER TABLE audits
  ADD COLUMN auditOrganisme VARCHAR(100) NULL COMMENT 'BSI, TÜV, SGS, FDA, MDSAP, Autre',
  ADD COLUMN auditOrganismeNom VARCHAR(255) NULL COMMENT 'Nom exact de l organisme',
  ADD COLUMN auditDatePrevue DATE NULL COMMENT 'Date prévue de l audit externe',
  ADD COLUMN auditTypeExterne VARCHAR(50) NULL COMMENT 'certification_initiale, surveillance, renouvellement, inspection',
  ADD COLUMN preparationPlan JSON NULL COMMENT 'Plan de préparation généré par IA',
  ADD COLUMN preparationNiveauRisque VARCHAR(20) NULL,
  ADD COLUMN preparationGeneratedAt DATETIME NULL,
  ADD COLUMN postAuditDecision VARCHAR(50) NULL COMMENT 'certifie, suspendu, refuse, observation',
  ADD COLUMN postAuditNotes TEXT NULL;

CREATE TABLE preparation_checklist (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  auditId INT NOT NULL,
  userId INT NOT NULL,
  category VARCHAR(100) NOT NULL,
  item TEXT NOT NULL,
  exigence VARCHAR(255) NULL,
  statut ENUM('non_verifie','ok','attention') NOT NULL DEFAULT 'non_verifie',
  note TEXT NULL,
  documentRef VARCHAR(255) NULL,
  linkedCapaId INT NULL,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_audit (auditId),
  INDEX idx_user (userId)
);

CREATE TABLE simulation_results (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  auditId INT NOT NULL,
  userId INT NOT NULL,
  processus VARCHAR(100) NOT NULL,
  question TEXT NOT NULL,
  contexte TEXT NULL,
  orientationReponse TEXT NULL,
  preuvesAttendues JSON NULL,
  criticite VARCHAR(20) NULL,
  reponseUtilisateur TEXT NULL,
  scoreIA TINYINT NULL COMMENT '0-100',
  feedbackIA TEXT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_simulation_audit (auditId)
);
