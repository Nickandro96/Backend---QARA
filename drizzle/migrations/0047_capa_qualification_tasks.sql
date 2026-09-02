ALTER TABLE capa_actions
  ADD COLUMN qualificationDecision ENUM(
    'a_qualifier','capa_requise','correction_simple','surveillance',
    'acceptation_justifiee','doublon','non_applicable_apres_revue'
  ) NOT NULL DEFAULT 'a_qualifier',
  ADD COLUMN qualificationJustification TEXT NULL,
  ADD COLUMN qualificationOwner VARCHAR(255) NULL,
  ADD COLUMN qualificationAt TIMESTAMP NULL,
  ADD COLUMN impactPatient ENUM('aucun','potentiel','avere','inconnu') NULL,
  ADD COLUMN impactReglementaire ENUM('aucun','potentiel','avere','inconnu') NULL;

CREATE TABLE capa_tasks (
  id INT NOT NULL AUTO_INCREMENT,
  capaId INT NOT NULL,
  userId INT NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NULL,
  responsible VARCHAR(255) NULL,
  dueDate TIMESTAMP NULL,
  priority ENUM('basse','moyenne','haute','critique') NOT NULL DEFAULT 'moyenne',
  status ENUM('a_faire','en_cours','a_verifier','cloturee','annulee') NOT NULL DEFAULT 'a_faire',
  completionEvidence TEXT NULL,
  effectivenessCriterion TEXT NULL,
  effectivenessResult ENUM('efficace','inefficace','non_verifiee') NOT NULL DEFAULT 'non_verifiee',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX capa_tasks_capa_idx (capaId),
  INDEX capa_tasks_user_idx (userId),
  CONSTRAINT capa_tasks_capa_fk FOREIGN KEY (capaId) REFERENCES capa_actions(id),
  CONSTRAINT capa_tasks_user_fk FOREIGN KEY (userId) REFERENCES users(id)
);

INSERT INTO capa_tasks (capaId, userId, title, description, responsible, dueDate, status, completionEvidence, effectivenessResult)
SELECT id, userId, LEFT(actionRetenue, 500), actionRetenue, responsible, dueDate,
  CASE
    WHEN statut = 'ouverte' THEN 'a_faire'
    WHEN statut = 'en_cours' THEN 'en_cours'
    WHEN statut = 'a_verifier' THEN 'a_verifier'
    WHEN statut IN ('cloturee_efficace','cloturee_inefficace','cloturee_sans_suite') THEN 'cloturee'
  END,
  preuveRealisation,
  CASE
    WHEN resultatEfficacite = 'efficace' THEN 'efficace'
    WHEN resultatEfficacite = 'inefficace' THEN 'inefficace'
    ELSE 'non_verifiee'
  END
FROM capa_actions
WHERE actionRetenue IS NOT NULL AND TRIM(actionRetenue) <> '';
