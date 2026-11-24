/* ========================================================
   Données de Démonstration (Seed) Génériques
   ======================================================== */

SET NAMES utf8mb4;

/* 1. Utilisateurs Démo */
INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `avatar_color`, `initials`) VALUES
(1, 'Alexandre', 'alexandre@example.com', '$2y$10$wKz0b9lM9V5bYI.m9Hn42OKxJ4qZJomk8f2aG4R1qO7C0YhT1K1wS', 'admin', '#2563EB', 'AL'),
(2, 'Béatrice', 'beatrice@example.com', '$2y$10$wKz0b9lM9V5bYI.m9Hn42OKxJ4qZJomk8f2aG4R1qO7C0YhT1K1wS', 'admin', '#7C3AED', 'BE'),
(3, 'Camille', 'camille@example.com', '$2y$10$wKz0b9lM9V5bYI.m9Hn42OKxJ4qZJomk8f2aG4R1qO7C0YhT1K1wS', 'write', '#059669', 'CA'),
(4, 'Damien', 'damien@example.com', '$2y$10$wKz0b9lM9V5bYI.m9Hn42OKxJ4qZJomk8f2aG4R1qO7C0YhT1K1wS', 'write', '#D97706', 'DA');

/* 2. Propriétés Démo */
INSERT INTO `properties` (`id`, `name`, `code`, `color`, `is_active`) VALUES
(1, 'Résidence Centre', 'RC', '#3B82F6', 1),
(2, 'Studio Sud', 'SS', '#EC4899', 1),
(3, 'Villa Colline', 'VC', '#10B981', 1),
(4, 'Loft Urbain', 'LU', '#8B5CF6', 1),
(5, 'Appartement Panorama', 'AP', '#F59E0B', 1);

/* 3. Sprint initial */
INSERT INTO `sprints` (`id`, `number`, `name`, `status`, `started_at`, `notes`) VALUES
(1, 1, 'Sprint 1 — Lancement', 'active', NOW(), 'Sprint initial pour tester le tableau Kanban.');

/* 4. Tâches d''exemple */
INSERT INTO `tasks` (`id`, `sprint_id`, `title`, `description`, `status`, `assigned_to`, `created_by`, `property_id`, `priority`, `position`, `is_unplanned`) VALUES
(1, 1, 'Préparation des modèles de contrats pour les nouveaux clients', 'Mettre en forme le document avec les clauses standards.', 'todo', NULL, 1, NULL, 'medium', 1, 0),
(2, 1, 'Mise à jour du site web et vérification des coordonnées', 'Vérifier le formulaire de contact.', 'todo', NULL, 2, NULL, 'low', 2, 0),
(3, 1, 'Contrôle des stocks de consommables et fournitures', 'Faire l''inventaire général de fin de mois.', 'in_progress', 4, 4, 1, 'high', 1, 0),
(4, 1, 'Remplacement des serrures connectées', 'Installation et test d''ouverture par smartphone.', 'in_progress', 4, 4, 2, 'high', 2, 0),
(5, 1, 'Répondre aux demandes et avis clients de la semaine', 'Traitement des messages en attente.', 'in_progress', 3, 3, NULL, 'medium', 1, 0),
(6, 1, 'Finaliser le tableau de bord prévisionnel trimestriel', 'Point comptable avant validation finale.', 'in_progress', 2, 2, NULL, 'high', 1, 0),
(7, 1, 'Configuration et déploiement du tableau Kanban', 'Vérifier la bonne synchronisation avec la base de données.', 'done', 1, 1, NULL, 'high', 1, 0);

/* 5. Sous-tâches Démo */
INSERT INTO `subtasks` (`task_id`, `title`, `is_done`, `position`) VALUES
(3, 'Compter les produits d''accueil restants', 1, 1),
(3, 'Passer la commande auprès du fournisseur', 0, 2),
(4, 'Acheter les nouveaux boîtiers', 1, 1),
(4, 'Programmer les codes d''accès temporaires', 0, 2),
(7, 'Créer la structure des tables MySQL', 1, 1),
(7, 'Tester l''API REST', 1, 2);

/* 6. Questions Démo */
INSERT INTO `questions` (`sprint_id`, `user_id`, `created_by`, `title`, `details`, `status`) VALUES
(1, 4, 4, 'Organisation des plannings d''intervention pour le mois prochain', 'Définir les créneaux prioritaires avec les prestataires.', 'open'),
(1, 3, 3, 'Optimisation des messages automatiques d''accueil', 'Harmoniser les consignes d''arrivée envoyées aux voyageurs.', 'open'),
(1, 2, 2, 'Validation des devis pour les travaux de rénovation', 'Arbitrage sur les deux propositions reçues.', 'open'),
(1, 1, 1, 'Point sur les nouvelles fonctionnalités souhaitées pour le tableau', 'Recueillir les retours des utilisateurs après la première semaine.', 'open');
