/* ========================================================
   Migration v9 : Correctif idempotent statut 'pending' & 'is_new'
   - Corrige toute base ayant déjà enregistré v8 sous une version antérieure
   - Supprime l'éventuelle table transitoire sprint_pending_tasks
   - Garantit 'pending' dans sprint_tasks.status et la colonne is_new
   ======================================================== */

SET NAMES utf8mb4;

DROP TABLE IF EXISTS `sprint_pending_tasks`;

ALTER TABLE `sprint_tasks`
  MODIFY COLUMN `status` ENUM('pending', 'todo', 'in_progress', 'blocked', 'done') NOT NULL DEFAULT 'todo';

SET @has_is_new := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sprint_tasks'
    AND COLUMN_NAME = 'is_new'
);
SET @sql_add_is_new := IF(
  @has_is_new = 0,
  'ALTER TABLE `sprint_tasks` ADD COLUMN `is_new` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_starred`',
  'SELECT 1'
);
PREPARE stmt_is_new FROM @sql_add_is_new;
EXECUTE stmt_is_new;
DEALLOCATE PREPARE stmt_is_new;

INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('v8_meeting_pending_tasks'), ('v9_sprint_pending_status');
