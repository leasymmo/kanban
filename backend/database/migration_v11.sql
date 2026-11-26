/* ========================================================
   Migration v11 : Simplification des Questions & Réponses
   - Suppression des colonnes status, answered_by, answered_at sur questions
     (avec suppression préalable de l'éventuelle contrainte FK sur answered_by)
   - Dédoublonnage + contrainte UNIQUE (question_id, user_id) sur question_answers
     (1 seule réponse indicative par associé et par question)
   - Purge des réponses indicatives sur les sprints déjà clôturés
   ======================================================== */

SET NAMES utf8mb4;

/* 1. Suppression conditionnelle de la contrainte FK sur questions.answered_by */
SET @fk_answered_by := (
  SELECT CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'answered_by'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @sql_drop_fk := IF(
  @fk_answered_by IS NOT NULL,
  CONCAT('ALTER TABLE `questions` DROP FOREIGN KEY `', @fk_answered_by, '`'),
  'SELECT 1'
);
PREPARE stmt_drop_fk FROM @sql_drop_fk;
EXECUTE stmt_drop_fk;
DEALLOCATE PREPARE stmt_drop_fk;

/* 2. Suppression conditionnelle des colonnes status, answered_by, answered_at */
SET @has_q_status := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'status'
);
SET @sql_drop_status := IF(
  @has_q_status > 0,
  'ALTER TABLE `questions` DROP COLUMN `status`',
  'SELECT 1'
);
PREPARE stmt_drop_status FROM @sql_drop_status;
EXECUTE stmt_drop_status;
DEALLOCATE PREPARE stmt_drop_status;

SET @has_q_answered_by := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'answered_by'
);
SET @sql_drop_answered_by := IF(
  @has_q_answered_by > 0,
  'ALTER TABLE `questions` DROP COLUMN `answered_by`',
  'SELECT 1'
);
PREPARE stmt_drop_answered_by FROM @sql_drop_answered_by;
EXECUTE stmt_drop_answered_by;
DEALLOCATE PREPARE stmt_drop_answered_by;

SET @has_q_answered_at := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'questions'
    AND COLUMN_NAME = 'answered_at'
);
SET @sql_drop_answered_at := IF(
  @has_q_answered_at > 0,
  'ALTER TABLE `questions` DROP COLUMN `answered_at`',
  'SELECT 1'
);
PREPARE stmt_drop_answered_at FROM @sql_drop_answered_at;
EXECUTE stmt_drop_answered_at;
DEALLOCATE PREPARE stmt_drop_answered_at;

/* 3. Purge des réponses indicatives rattachées aux sprints déjà clôturés */
DELETE qa
FROM `question_answers` qa
INNER JOIN `questions` q ON q.`id` = qa.`question_id`
INNER JOIN `sprints` s ON s.`id` = q.`sprint_id`
WHERE s.`status` = 'closed';

/* 4. Dédoublonnage de question_answers avant ajout de la contrainte unique */
DELETE qa1
FROM `question_answers` qa1
INNER JOIN `question_answers` qa2
  ON qa1.`question_id` = qa2.`question_id`
 AND qa1.`user_id` = qa2.`user_id`
 AND (
   qa1.`updated_at` < qa2.`updated_at`
   OR (qa1.`updated_at` = qa2.`updated_at` AND qa1.`id` < qa2.`id`)
 );

/* 5. Ajout conditionnel de l'index unique (question_id, user_id) */
SET @has_uniq_qa := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'question_answers'
    AND INDEX_NAME = 'uniq_question_user'
);
SET @sql_add_uniq_qa := IF(
  @has_uniq_qa = 0,
  'ALTER TABLE `question_answers` ADD UNIQUE KEY `uniq_question_user` (`question_id`, `user_id`)',
  'SELECT 1'
);
PREPARE stmt_add_uniq_qa FROM @sql_add_uniq_qa;
EXECUTE stmt_add_uniq_qa;
DEALLOCATE PREPARE stmt_add_uniq_qa;

INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('v11_questions_simplify_unique_answers');
