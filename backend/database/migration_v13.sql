/* ========================================================
   Migration v13 : Index composites pour pagination keyset, filtres et tris rapides
   ======================================================== */

SET NAMES utf8mb4;

/* 1. Tâches : tris et filtres par échéance, priorité, dates et logement */
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND INDEX_NAME = 'idx_tasks_prop_id');
SET @sql := IF(@idx = 0, 'ALTER TABLE `tasks` ADD INDEX `idx_tasks_prop_id` (`property_id`, `id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND INDEX_NAME = 'idx_tasks_created_id');
SET @sql := IF(@idx = 0, 'ALTER TABLE `tasks` ADD INDEX `idx_tasks_created_id` (`created_at`, `id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND INDEX_NAME = 'idx_tasks_updated_id');
SET @sql := IF(@idx = 0, 'ALTER TABLE `tasks` ADD INDEX `idx_tasks_updated_id` (`updated_at`, `id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND INDEX_NAME = 'idx_tasks_due_id');
SET @sql := IF(@idx = 0, 'ALTER TABLE `tasks` ADD INDEX `idx_tasks_due_id` (`due_date`, `id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND INDEX_NAME = 'idx_tasks_prio_id');
SET @sql := IF(@idx = 0, 'ALTER TABLE `tasks` ADD INDEX `idx_tasks_prio_id` (`priority`, `id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND INDEX_NAME = 'idx_tasks_title_id');
SET @sql := IF(@idx = 0, 'ALTER TABLE `tasks` ADD INDEX `idx_tasks_title_id` (`title`(100), `id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* 2. Sprint <-> Tâches : index couvrants pour Kanban par colonne, filtres assignés et tris position */
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sprint_tasks' AND INDEX_NAME = 'idx_st_sprint_status_pos_task');
SET @sql := IF(@idx = 0, 'ALTER TABLE `sprint_tasks` ADD INDEX `idx_st_sprint_status_pos_task` (`sprint_id`, `status`, `position`, `task_id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sprint_tasks' AND INDEX_NAME = 'idx_st_sprint_assigned_status_pos');
SET @sql := IF(@idx = 0, 'ALTER TABLE `sprint_tasks` ADD INDEX `idx_st_sprint_assigned_status_pos` (`sprint_id`, `assigned_to`, `status`, `position`, `task_id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sprint_tasks' AND INDEX_NAME = 'idx_st_sprint_pos_task');
SET @sql := IF(@idx = 0, 'ALTER TABLE `sprint_tasks` ADD INDEX `idx_st_sprint_pos_task` (`sprint_id`, `position`, `task_id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/* 3. Questions : tris par création / associé et facettes rapides */
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND INDEX_NAME = 'idx_questions_sprint_created_id');
SET @sql := IF(@idx = 0, 'ALTER TABLE `questions` ADD INDEX `idx_questions_sprint_created_id` (`sprint_id`, `created_at`, `id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'questions' AND INDEX_NAME = 'idx_questions_sprint_user_created_id');
SET @sql := IF(@idx = 0, 'ALTER TABLE `questions` ADD INDEX `idx_questions_sprint_user_created_id` (`sprint_id`, `user_id`, `created_at`, `id`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('v13_pagination_indexes');
