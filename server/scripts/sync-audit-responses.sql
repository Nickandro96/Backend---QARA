-- Script de synchronisation forcée pour la table audit_responses
-- Ajoute les colonnes manquantes identifiées par l'erreur ER_BAD_FIELD_ERROR

-- 1. Ajout des colonnes si elles n'existent pas
SET @dbname = DATABASE();
SET @tablename = 'audit_responses';

-- Procédure pour ajouter des colonnes de manière idempotente
DROP PROCEDURE IF EXISTS AddColumnIfNotExist;
DELIMITER //
CREATE PROCEDURE AddColumnIfNotExist(IN colName VARCHAR(64), IN colDef VARCHAR(255))
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.COLUMNS 
        WHERE TABLE_SCHEMA = @dbname 
        AND TABLE_NAME = @tablename 
        AND COLUMN_NAME = colName
    ) THEN
        SET @sql = CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', colName, ' ', colDef);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

-- Exécution pour chaque colonne manquante ou nécessaire
CALL AddColumnIfNotExist('auditId', 'INT NOT NULL');
CALL AddColumnIfNotExist('questionKey', 'VARCHAR(255) NOT NULL');
CALL AddColumnIfNotExist('responseValue', "VARCHAR(50)");
CALL AddColumnIfNotExist('responseComment', 'TEXT');
CALL AddColumnIfNotExist('note', 'TEXT');
CALL AddColumnIfNotExist('role', 'VARCHAR(50)');
CALL AddColumnIfNotExist('processId', 'VARCHAR(50)');
CALL AddColumnIfNotExist('evidenceFiles', 'JSON');
CALL AddColumnIfNotExist('answeredBy', 'INT');
CALL AddColumnIfNotExist('answeredAt', 'DATETIME');

-- 2. Création de l'index unique s'il n'existe pas
DROP PROCEDURE IF EXISTS AddUniqueIndexIfNotExist;
DELIMITER //
CREATE PROCEDURE AddUniqueIndexIfNotExist()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM information_schema.STATISTICS 
        WHERE TABLE_SCHEMA = @dbname 
        AND TABLE_NAME = @tablename 
        AND INDEX_NAME = 'user_audit_question_key_idx'
    ) THEN
        ALTER TABLE `audit_responses` ADD UNIQUE INDEX `user_audit_question_key_idx` (`userId`,`auditId`,`questionKey`);
    END IF;
END //
DELIMITER ;

CALL AddUniqueIndexIfNotExist();

-- Nettoyage
DROP PROCEDURE IF EXISTS AddColumnIfNotExist;
DROP PROCEDURE IF EXISTS AddUniqueIndexIfNotExist;
