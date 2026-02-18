-- 0008_dedupe_and_unique_questionKey.sql
-- Objectif:
-- 1) Supprimer d’éventuels doublons sur questionKey (on garde l’id le plus petit)
-- 2) Ajouter une contrainte UNIQUE sur questionKey (safe)

-- 1) DEDUPE: supprime les doublons (garde la plus ancienne ligne)
DELETE q1
FROM questions q1
JOIN questions q2
  ON q1.questionKey = q2.questionKey
 AND q1.id > q2.id;

-- 2) UNIQUE index (si déjà présent, le workflow "apply-sql-migrations" ignore ER_DUP_KEYNAME)
ALTER TABLE questions
  ADD UNIQUE KEY uq_questions_questionKey (questionKey);
