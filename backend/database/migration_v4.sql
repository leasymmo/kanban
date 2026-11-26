/* ========================================================
   Migration V4 - Soft delete sur les hébergements (properties)
   Ajout de deleted_at pour tracer la désactivation tout en
   conservant l'historique des sprints passés.
   ======================================================== */

SET NAMES utf8mb4;

ALTER TABLE `properties`
  ADD COLUMN `deleted_at` DATETIME NULL DEFAULT NULL AFTER `is_active`;
