/* ========================================================
   Migration V5 - Ordre d'affichage des hébergements
   Ajout de position sur properties pour personnaliser
   l'ordre d'affichage dans toute l'application.
   ======================================================== */

SET NAMES utf8mb4;

ALTER TABLE `properties`
  ADD COLUMN `position` INT NOT NULL DEFAULT 0 AFTER `color`;

SET @pos := 0;
UPDATE `properties`
SET `position` = (@pos := @pos + 1)
ORDER BY `is_active` DESC, `name` ASC, `id` ASC;
