/* ========================================================
   Migration V2 - Kanban Dashboard
   1. Sous-tâches multi-niveaux (au moins 4 niveaux récursifs)
   2. Réponses collaboratives aux questions
   3. Réponse définitive / arbitrage en réunion
   ======================================================== */

USE `carredjkanban`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. Ajout de parent_id dans subtasks (pour sous-tâches de sous-tâches)
ALTER TABLE `subtasks`
  ADD COLUMN `parent_id` INT NULL DEFAULT NULL AFTER `task_id`,
  ADD CONSTRAINT `fk_subtasks_parent` FOREIGN KEY (`parent_id`) REFERENCES `subtasks`(`id`) ON DELETE CASCADE;

-- 2. Ajout des colonnes de décision finale dans questions
ALTER TABLE `questions`
  ADD COLUMN `final_answer` TEXT NULL DEFAULT NULL AFTER `status`,
  ADD COLUMN `answered_by` INT NULL DEFAULT NULL AFTER `final_answer`,
  ADD COLUMN `answered_at` DATETIME NULL DEFAULT NULL AFTER `answered_by`,
  ADD CONSTRAINT `fk_questions_answered_by` FOREIGN KEY (`answered_by`) REFERENCES `users`(`id`) ON DELETE SET NULL;

-- 3. Table des réponses collaboratives aux questions
CREATE TABLE IF NOT EXISTS `question_answers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `question_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
