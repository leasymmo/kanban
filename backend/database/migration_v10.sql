/* ========================================================
   Migration v10 : Tâches non attribuées au statut 'pending'
   - Toutes les tâches non attribuées actuelles (assigned_to IS NULL)
     du sprint actif passent au statut 'pending' (et is_starred = 0).
   - Nettoie l'éventuelle colonne transitoire is_meeting_pending si présente.
   ======================================================== */

SET NAMES utf8mb4;

SET @has_is_meeting_pending := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'sprint_tasks'
    AND COLUMN_NAME = 'is_meeting_pending'
);
SET @sql_drop_imp := IF(
  @has_is_meeting_pending > 0,
  'ALTER TABLE `sprint_tasks` DROP COLUMN `is_meeting_pending`',
  'SELECT 1'
);
PREPARE stmt_drop_imp FROM @sql_drop_imp;
EXECUTE stmt_drop_imp;
DEALLOCATE PREPARE stmt_drop_imp;

UPDATE `sprint_tasks` st
JOIN `sprints` s ON s.`id` = st.`sprint_id`
SET st.`status` = 'pending',
    st.`is_starred` = 0
WHERE s.`status` = 'active'
  AND st.`assigned_to` IS NULL
  AND st.`status` != 'pending';

INSERT IGNORE INTO `schema_migrations` (`version`) VALUES ('v10_unassigned_tasks_pending');
