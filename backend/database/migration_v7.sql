/* ========================================================
   Migration v7 : Déplacement de assigned_to vers sprint_tasks
   Permet d'historiser le responsable réel d'une tâche
   sprint par sprint et de le conserver au report.
   ======================================================== */

SET NAMES utf8mb4;

ALTER TABLE `sprint_tasks`
  ADD COLUMN `assigned_to` INT NULL DEFAULT NULL AFTER `status`,
  ADD INDEX `idx_sprint_assigned` (`sprint_id`, `assigned_to`),
  ADD CONSTRAINT `fk_sprint_tasks_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL;

-- Copie du responsable actuel depuis tasks vers sprint_tasks
UPDATE `sprint_tasks` st
JOIN `tasks` t ON t.`id` = st.`task_id`
SET st.`assigned_to` = t.`assigned_to`
WHERE st.`assigned_to` IS NULL AND t.`assigned_to` IS NOT NULL;

-- Suppression dynamique de la clé étrangère éventuelle puis de la colonne tasks.assigned_to
SET @fk_assigned := (
  SELECT CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tasks'
    AND COLUMN_NAME = 'assigned_to'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @sql_drop_fk := IF(
  @fk_assigned IS NOT NULL,
  CONCAT('ALTER TABLE `tasks` DROP FOREIGN KEY `', @fk_assigned, '`'),
  'SELECT 1'
);
PREPARE stmt_drop_fk FROM @sql_drop_fk;
EXECUTE stmt_drop_fk;
DEALLOCATE PREPARE stmt_drop_fk;

ALTER TABLE `tasks` DROP COLUMN `assigned_to`;

INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('v7_sprint_tasks_assigned_to');
