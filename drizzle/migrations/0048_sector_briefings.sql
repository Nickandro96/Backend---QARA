CREATE TABLE sector_briefings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  topic VARCHAR(50) NOT NULL,
  referential VARCHAR(20) NOT NULL,
  titre VARCHAR(500) NOT NULL,
  content JSON NOT NULL,
  sources_used JSON NOT NULL,
  ai_model VARCHAR(50) NOT NULL,
  confidence_level VARCHAR(10) NOT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valid_until DATETIME NOT NULL,
  view_count INT NOT NULL DEFAULT 0,
  INDEX idx_topic_ref (topic, referential),
  INDEX idx_generated (generated_at)
);
