/* ========================================================
   Données de Démonstration (Seed) Génériques
   ======================================================== */

SET NAMES utf8mb4;

/* 1. Utilisateurs Démo */
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `avatar_color`, `initials`) VALUES
(1, 'Alexandre', 'alexandre@example.com', '$2y$10$hlNwWbr0bWb6zib8A3iUXuHidlfR4XADpvmRTvXCbxnguwUtxdfai', 'admin', '#2563EB', 'AL'),
(2, 'Béatrice', 'beatrice@example.com', '$2y$10$hlNwWbr0bWb6zib8A3iUXuHidlfR4XADpvmRTvXCbxnguwUtxdfai', 'admin', '#7C3AED', 'BE'),
(3, 'Camille', 'camille@example.com', '$2y$10$hlNwWbr0bWb6zib8A3iUXuHidlfR4XADpvmRTvXCbxnguwUtxdfai', 'write', '#059669', 'CA'),
(4, 'Damien', 'damien@example.com', '$2y$10$hlNwWbr0bWb6zib8A3iUXuHidlfR4XADpvmRTvXCbxnguwUtxdfai', 'write', '#D97706', 'DA');

/* 2. Propriétés Démo */
INSERT INTO `properties` (`id`, `name`, `code`, `color`, `position`, `is_active`) VALUES
(1, 'Résidence Centre', 'RC', '#3B82F6', 1, 1),
(2, 'Studio Sud', 'SS', '#EC4899', 2, 1),
(3, 'Villa Colline', 'VC', '#10B981', 3, 1),
(4, 'Loft Urbain', 'LU', '#8B5CF6', 4, 1),
(5, 'Appartement Panorama', 'AP', '#F59E0B', 5, 1);

/* 3. Sprint initial */
INSERT INTO `sprints` (`id`, `number`, `name`, `status`, `started_at`, `notes`) VALUES
(1, 1, 'Sprint 1 — Lancement', 'active', NOW(), 'Sprint initial pour tester le tableau Kanban.');

/* 4. Tâches d''exemple */
INSERT INTO `tasks` (`id`, `title`, `description`, `created_by`, `property_id`, `priority`) VALUES
(1, 'Préparation des modèles de contrats pour les nouveaux clients', 'Mettre en forme le document avec les clauses standards.', 1, NULL, 'medium'),
(2, 'Mise à jour du site web et vérification des coordonnées', 'Vérifier le formulaire de contact.', 2, NULL, 'low'),
(3, 'Contrôle des stocks de consommables et fournitures', 'Faire l''inventaire général de fin de mois.', 4, 1, 'high'),
(4, 'Remplacement des serrures connectées', 'Installation et test d''ouverture par smartphone.', 4, 2, 'high'),
(5, 'Répondre aux demandes et avis clients de la semaine', 'Traitement des messages en attente.', 3, NULL, 'medium'),
(6, 'Finaliser le tableau de bord prévisionnel trimestriel', 'Point comptable avant validation finale.', 2, NULL, 'high'),
(7, 'Configuration et déploiement du tableau Kanban', 'Vérifier la bonne synchronisation avec la base de données.', 1, NULL, 'high');

/* 4b. Liaison Sprint <-> Tâches */
INSERT INTO `sprint_tasks` (`sprint_id`, `task_id`, `status`, `assigned_to`, `position`, `is_unplanned`, `is_starred`) VALUES
(1, 1, 'pending', NULL, 1, 0, 0),
(1, 2, 'pending', NULL, 2, 0, 0),
(1, 3, 'in_progress', 4, 3, 0, 0),
(1, 4, 'in_progress', 4, 4, 0, 0),
(1, 5, 'in_progress', 3, 5, 0, 0),
(1, 6, 'in_progress', 2, 6, 0, 0),
(1, 7, 'done', 1, 7, 0, 0);

/* 5. Sous-tâches Démo */
INSERT INTO `subtasks` (`task_id`, `title`, `is_done`, `position`) VALUES
(3, 'Compter les produits d''accueil restants', 1, 1),
(3, 'Passer la commande auprès du fournisseur', 0, 2),
(4, 'Acheter les nouveaux boîtiers', 1, 1),
(4, 'Programmer les codes d''accès temporaires', 0, 2),
(7, 'Créer la structure des tables MySQL', 1, 1),
(7, 'Tester l''API REST', 1, 2);

/* 6. Questions Démo */
INSERT INTO `questions` (`sprint_id`, `user_id`, `created_by`, `title`, `details`) VALUES
(1, 4, 4, 'Organisation des plannings d''intervention pour le mois prochain', 'Définir les créneaux prioritaires avec les prestataires.'),
(1, 3, 3, 'Optimisation des messages automatiques d''accueil', 'Harmoniser les consignes d''arrivée envoyées aux voyageurs.'),
(1, 2, 2, 'Validation des devis pour les travaux de rénovation', 'Arbitrage sur les deux propositions reçues.'),
(1, 1, 1, 'Point sur les nouvelles fonctionnalités souhaitées pour le tableau', 'Recueillir les retours des utilisateurs après la première semaine.');
