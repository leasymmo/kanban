/* ========================================================
   Dashboard Kanban - Base de Données MySQL
   ======================================================== */

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

/* 0. Suppression dans l'ordre inverse des dépendances */
DROP TABLE IF EXISTS `question_answers`;
DROP TABLE IF EXISTS `subtask_sprint_states`;
DROP TABLE IF EXISTS `subtasks`;
DROP TABLE IF EXISTS `sprint_tasks`;
DROP TABLE IF EXISTS `tasks`;
DROP TABLE IF EXISTS `questions`;
DROP TABLE IF EXISTS `user_sessions`;
DROP TABLE IF EXISTS `sprints`;
DROP TABLE IF EXISTS `properties`;
DROP TABLE IF EXISTS `users`;

/* 1. Utilisateurs (Associés & Comptes) */
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'write', 'read') NOT NULL DEFAULT 'write',
  `avatar_color` VARCHAR(20) DEFAULT '#2563EB',
  `initials` VARCHAR(4) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 2. Logements / Propriétés */
CREATE TABLE `properties` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `code` VARCHAR(20) NULL,
  `color` VARCHAR(20) DEFAULT '#3B82F6',
  `position` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) DEFAULT 1,
  `deleted_at` DATETIME NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 3. Sprints (Réunions hebdomadaires) */
CREATE TABLE `sprints` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `number` INT NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `status` ENUM('active', 'closed') NOT NULL DEFAULT 'active',
  `started_at` DATETIME NOT NULL,
  `closed_at` DATETIME NULL,
  `closed_by` INT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 4. Tâches */
CREATE TABLE `tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NULL,
  `created_by` INT NOT NULL,
  `property_id` INT NULL,
  `priority` ENUM('low', 'medium', 'high') DEFAULT 'medium',
  `due_date` DATE NULL,
  `parent_task_id` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
  FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`parent_task_id`) REFERENCES `tasks`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 4b. Table d'association N-N Sprints <-> Tâches (statut, responsable, position, tags spécifiques au sprint) */
CREATE TABLE `sprint_tasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sprint_id` INT NOT NULL,
  `task_id` INT NOT NULL,
  `status` ENUM('pending', 'todo', 'in_progress', 'blocked', 'done') NOT NULL DEFAULT 'todo',
  `assigned_to` INT NULL DEFAULT NULL,
  `position` INT NOT NULL DEFAULT 0,
  `is_unplanned` TINYINT(1) NOT NULL DEFAULT 0,
  `is_starred` TINYINT(1) NOT NULL DEFAULT 0,
  `is_new` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_sprint_task` (`sprint_id`, `task_id`),
  INDEX `idx_sprint_status_pos` (`sprint_id`, `status`, `position`),
  INDEX `idx_sprint_assigned` (`sprint_id`, `assigned_to`),
  FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`assigned_to`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 5. Sous-tâches (Checklist & hiérarchie récursive multi-niveaux) */
CREATE TABLE `subtasks` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `task_id` INT NOT NULL,
  `parent_id` INT NULL DEFAULT NULL,
  `title` VARCHAR(255) NOT NULL,
  `is_done` TINYINT(1) NOT NULL DEFAULT 0,
  `position` INT DEFAULT 0,
  `created_sprint_id` INT NULL DEFAULT NULL,
  `deleted_sprint_id` INT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_subtasks_task_pos` (`task_id`, `position`),
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`parent_id`) REFERENCES `subtasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_sprint_id`) REFERENCES `sprints`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`deleted_sprint_id`) REFERENCES `sprints`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 5b. États différentiels des sous-tâches par sprint (historisation à la clôture uniquement) */
CREATE TABLE `subtask_sprint_states` (
  `subtask_id` INT NOT NULL,
  `sprint_id` INT NOT NULL,
  `is_done` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`subtask_id`, `sprint_id`),
  INDEX `idx_sss_sprint` (`sprint_id`),
  FOREIGN KEY (`subtask_id`) REFERENCES `subtasks`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 6. Questions / Sujets stratégiques de réunion */
CREATE TABLE `questions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sprint_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `created_by` INT NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `details` TEXT NULL,
  `final_answer` TEXT NULL DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`sprint_id`) REFERENCES `sprints`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 6b. Réponses indicatives préparatoires aux questions (1 max par associé, purgées à la clôture du sprint) */
CREATE TABLE `question_answers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `question_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_question_user` (`question_id`, `user_id`),
  FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/* 7. Journal des sessions */
CREATE TABLE `user_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `token` VARCHAR(128) NOT NULL UNIQUE,
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
