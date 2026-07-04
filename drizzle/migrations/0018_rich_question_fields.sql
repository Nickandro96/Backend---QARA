-- Adds the 9 "rich" columns needed to import the verified content corpus
-- (473 questions, 7 referentials, see docs/audit/07-import-corpus.md) without
-- losing auditor depth/pedagogy that the existing columns can't carry.
ALTER TABLE questions
  ADD COLUMN auditVerifies TEXT,
  ADD COLUMN relances JSON,
  ADD COLUMN explanationSimple TEXT,
  ADD COLUMN concreteExample TEXT,
  ADD COLUMN conformityCriteria JSON,
  ADD COLUMN typicalNc JSON,
  ADD COLUMN mappings JSON,
  ADD COLUMN referenceStatus VARCHAR(255),
  ADD COLUMN officialSource TEXT;
