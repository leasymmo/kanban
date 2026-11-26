/* ========================================================
   Migration v6 : Historisation différentielle des sous-tâches
   - created_sprint_id / deleted_sprint_id sur subtasks
   - Table subtask_sprint_states (deltas écrits uniquement à la clôture)
   ======================================================== */

SET NAMES utf8mb4;

ALTER TABLE `subtasks`
  ADD COLUMN `created_sprint_id` INT NULL DEFAULT NULL AFTER `position`,
  ADD COLUMN `deleted_sprint_id` INT NULL DEFAULT NULL AFTER `created_sprint_id`,
  ADD INDEX `idx_subtasks_task_pos` (`task_id`, `position`),
  ADD CONSTRAINT `fk_subtasks_created_sprint` FOREIGN KEY (`created_sprint_id`) REFERENCES `sprints`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_subtasks_deleted_sprint` FOREIGN KEY (`deleted_sprint_id`) REFERENCES `sprints`(`id`) ON DELETE SET NULL;

ALTER TABLE `sprint_tasks`
  ADD INDEX `idx_sprint_status_pos` (`sprint_id`, `status`, `position`);

CREATE TABLE IF NOT EXISTS `subtask_sprint_states` (
  `subtask_id` INT NOT NULL,
  `sprint_id` INT NOT NULL,
  `is_done` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`subtask_id`, `sprint_id`),
  INDEX `idx_sss_sprint` (`sprint_id`),
  CONSTRAINT `fk_sss_subtask` FOREIGN KEY (`subtask_id`) REFERENCES `subtasks`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sss_sprint` FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rétro-remplissage du sprint d'origine de chaque sous-tâche existante
UPDATE `subtasks` sub
SET sub.`created_sprint_id` = (
    SELECT s.`id`
    FROM `sprint_tasks` st
    JOIN `sprints` s ON s.`id` = st.`sprint_id`
    WHERE st.`task_id` = sub.`task_id`
    ORDER BY s.`number` ASC, st.`id` ASC
    LIMIT 1
)
WHERE sub.`created_sprint_id` IS NULL;

-- Rétro-remplissage minimal des états cochés sur les sprints déjà clôturés
INSERT IGNORE INTO `subtask_sprint_states` (`subtask_id`, `sprint_id`, `is_done`)
SELECT sub.`id`,
       (
           SELECT s.`id`
           FROM `sprint_tasks` st
           JOIN `sprints` s ON s.`id` = st.`sprint_id`
           WHERE st.`task_id` = sub.`task_id` AND s.`status` = 'closed'
           ORDER BY s.`number` ASC, st.`id` ASC
           LIMIT 1
       ) AS first_closed_sprint_id,
       1
FROM `subtasks` sub
WHERE sub.`is_done` = 1
  AND EXISTS (
      SELECT 1
      FROM `sprint_tasks` st
      JOIN `sprints` s ON s.`id` = st.`sprint_id`
      WHERE st.`task_id` = sub.`task_id` AND s.`status` = 'closed'
  );

INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('v6_subtask_sprint_states');
