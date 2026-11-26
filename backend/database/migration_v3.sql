/* ========================================================
   Migration V3 - Table d'association N-N sprint_tasks
   Les propriétés spécifiques à un sprint (statut, position,
   réalisation complémentaire, étoile) sont portées par
   la table de liaison sprint_tasks.
   ======================================================== */

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `sprint_tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sprint_id` INT NOT NULL,
  `task_id` INT NOT NULL,
  `status` ENUM('todo', 'in_progress', 'blocked', 'done') NOT NULL DEFAULT 'todo',
  `position` INT NOT NULL DEFAULT 0,
  `is_unplanned` TINYINT(1) NOT NULL DEFAULT 0,
  `is_starred` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_sprint_task` (`sprint_id`, `task_id`),
  FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `sprint_tasks` (`sprint_id`, `task_id`, `status`, `position`, `is_unplanned`, `is_starred`)
SELECT `sprint_id`, `id`, `status`, `position`, COALESCE(`is_unplanned`, 0), COALESCE(`is_starred`, 0)
FROM `tasks`
WHERE `sprint_id` IS NOT NULL;

SET FOREIGN_KEY_CHECKS = 1;
