INSERT INTO referentiels (id, code, name)
VALUES
  (2, 'ISO9001', 'ISO 9001'),
  (3, 'ISO13485', 'ISO 13485')
ON DUPLICATE KEY UPDATE
  code = VALUES(code),
  name = VALUES(name);
