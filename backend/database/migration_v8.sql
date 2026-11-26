/* ========================================================
   Migration v8 : Statut 'pending' (réunion) & tag 'Nouveau'
   - Ajout de 'pending' à sprint_tasks.status (jamais affiché dans Tâches)
   - Ajout de is_new sur sprint_tasks
   ======================================================== */

SET NAMES utf8mb4;

ALTER TABLE `sprint_tasks`
  MODIFY COLUMN `status` ENUM('pending', 'todo', 'in_progress', 'blocked', 'done') NOT NULL DEFAULT 'todo',
  ADD COLUMN `is_new` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_starred`;

INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('v8_meeting_pending_tasks');
