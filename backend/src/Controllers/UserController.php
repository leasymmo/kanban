<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use App\Request;

class UserController {
    /**
     * GET /api/users
     * Liste des associés pour les filtres et attributions
     */
    public function list(): void {
        $db = Database::getConnection();
        $currentUser = Auth::getCurrentUser();

        if (!$currentUser) {
            // Utilisateur non connecté : liste publique minimale pour le sélecteur d'avatar
            $stmt = $db->query("
                SELECT id, name, avatar_color, initials
                FROM users
                ORDER BY id ASC
            ");
            $users = $stmt->fetchAll();
        } else {
            // Utilisateur connecté : liste complète
            $stmt = $db->query("
                SELECT id, name, email, role, avatar_color, initials, created_at
                FROM users
                ORDER BY id ASC
            ");
            $users = $stmt->fetchAll();
        }

        Response::json([
            'success' => true,
            'users' => $users
        ]);
    }

    /**
     * POST /api/users
     * Ajout d'un nouvel utilisateur (Admin uniquement)
     */
    public function create(): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $body = Request::jsonBody();
        $name = Request::string($body, 'name');
        $email = strtolower(Request::string($body, 'email'));
        $password = Request::string($body, 'password', '', false);
        $role = in_array($body['role'] ?? '', ['admin', 'write', 'read'], true) ? $body['role'] : 'write';
        $avatarColor = Request::string($body, 'avatar_color', '#2563EB');
        $initials = strtoupper(Request::string($body, 'initials'));

        if ($name === '' || $email === '' || trim($password) === '') {
            Response::error('Le nom, l\'adresse email et le mot de passe sont obligatoires.', 400);
        }

        if (mb_strlen($name) > 100 || mb_strlen($email) > 150) {
            Response::error('Le nom (100 car. max) ou l\'email (150 car. max) est trop long.', 400);
        }

        if (mb_strlen($password) < 6) {
            Response::error('Le mot de passe doit contenir au moins 6 caractères.', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Adresse email invalide.', 400);
        }

        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $avatarColor)) {
            $avatarColor = '#2563EB';
        }
        $initials = mb_substr($initials, 0, 4);

        // Vérification de l'unicité de l'email
        $stmtCheck = $db->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
        $stmtCheck->execute([$email]);
        if ($stmtCheck->fetch()) {
            Response::error('Un utilisateur existe déjà avec cette adresse email.', 409);
        }

        // Calcul des initiales si non fournies
        if ($initials === '') {
            $parts = preg_split('/\s+/', $name) ?: [];
            if (count($parts) >= 2) {
                $initials = strtoupper(mb_substr($parts[0], 0, 1) . mb_substr($parts[1], 0, 1));
            } else {
                $initials = strtoupper(mb_substr($name, 0, 2));
            }
        }

        $passwordHash = password_hash($password, PASSWORD_BCRYPT);

        $stmt = $db->prepare("
            INSERT INTO users (name, email, password_hash, role, avatar_color, initials)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$name, $email, $passwordHash, $role, $avatarColor, $initials]);

        $newId = (int)$db->lastInsertId();

        Response::json([
            'success' => true,
            'message' => 'Utilisateur créé avec succès.',
            'user' => [
                'id' => $newId,
                'name' => $name,
                'email' => $email,
                'role' => $role,
                'avatar_color' => $avatarColor,
                'initials' => $initials
            ]
        ], 201);
    }

    /**
     * PUT /api/users/{id}
     * Modification d'un utilisateur (Admin uniquement)
     */
    public function update(int $id): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $stmtTarget = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
        $stmtTarget->execute([$id]);
        $targetUser = $stmtTarget->fetch();

        if (!$targetUser) {
            Response::error('Utilisateur introuvable.', 404);
        }

        $body = Request::jsonBody();
        $name = array_key_exists('name', $body) ? Request::string($body, 'name') : $targetUser['name'];
        $email = array_key_exists('email', $body) ? strtolower(Request::string($body, 'email')) : $targetUser['email'];
        $role = in_array($body['role'] ?? '', ['admin', 'write', 'read'], true) ? $body['role'] : $targetUser['role'];
        $avatarColor = array_key_exists('avatar_color', $body) ? Request::string($body, 'avatar_color') : $targetUser['avatar_color'];
        $initials = array_key_exists('initials', $body) ? strtoupper(Request::string($body, 'initials')) : $targetUser['initials'];
        $password = Request::string($body, 'password', '', false);

        if ($name === '' || $email === '') {
            Response::error('Le nom et l\'adresse email ne peuvent pas être vides.', 400);
        }

        if (mb_strlen($name) > 100 || mb_strlen($email) > 150) {
            Response::error('Le nom (100 car. max) ou l\'email (150 car. max) est trop long.', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Adresse email invalide.', 400);
        }

        $hasNewPassword = trim($password) !== '';
        if ($hasNewPassword && mb_strlen($password) < 6) {
            Response::error('Le mot de passe doit contenir au moins 6 caractères.', 400);
        }

        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $avatarColor)) {
            $avatarColor = $targetUser['avatar_color'] ?: '#2563EB';
        }
        $initials = mb_substr($initials, 0, 4);

        $roleChanged = ($role !== $targetUser['role']);

        $db->beginTransaction();
        try {
            // Vérification de l'unicité de l'email
            $stmtCheck = $db->prepare("SELECT id FROM users WHERE email = ? AND id != ? LIMIT 1");
            $stmtCheck->execute([$email, $id]);
            if ($stmtCheck->fetch()) {
                $db->rollBack();
                Response::error('Un autre utilisateur utilise déjà cette adresse email.', 409);
            }

            // Empêcher de rétrograder le dernier admin (verrou transactionnel)
            if ($targetUser['role'] === 'admin' && $role !== 'admin') {
                $stmtAdmins = $db->query("SELECT id FROM users WHERE role = 'admin' FOR UPDATE");
                $adminCount = count($stmtAdmins->fetchAll());
                if ($adminCount <= 1) {
                    $db->rollBack();
                    Response::error('Impossible de retirer les droits du seul administrateur restant.', 400);
                }
            }

            if ($hasNewPassword) {
                $passwordHash = password_hash($password, PASSWORD_BCRYPT);
                $stmt = $db->prepare("
                    UPDATE users
                    SET name = ?, email = ?, password_hash = ?, role = ?, avatar_color = ?, initials = ?
                    WHERE id = ?
                ");
                $stmt->execute([$name, $email, $passwordHash, $role, $avatarColor, $initials, $id]);
            } else {
                $stmt = $db->prepare("
                    UPDATE users
                    SET name = ?, email = ?, role = ?, avatar_color = ?, initials = ?
                    WHERE id = ?
                ");
                $stmt->execute([$name, $email, $role, $avatarColor, $initials, $id]);
            }

            // Révoquer les sessions existantes si le mot de passe ou le rôle a changé
            if ($hasNewPassword || $roleChanged) {
                $db->prepare("DELETE FROM user_sessions WHERE user_id = ?")->execute([$id]);
            }

            $db->commit();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('Erreur UserController::update : ' . $e->getMessage());
            Response::error('Erreur interne lors de la mise à jour de l\'utilisateur.', 500);
        }

        Response::json([
            'success' => true,
            'message' => 'Utilisateur mis à jour avec succès.',
            'user' => [
                'id' => $id,
                'name' => $name,
                'email' => $email,
                'role' => $role,
                'avatar_color' => $avatarColor,
                'initials' => $initials
            ]
        ]);
    }

    /**
     * DELETE /api/users/{id}
     * Suppression d'un utilisateur (Admin uniquement)
     */
    public function delete(int $id): void {
        $currentUser = Auth::requireAdmin();
        $db = Database::getConnection();

        if ($id === (int)$currentUser['id']) {
            Response::error('Vous ne pouvez pas supprimer votre propre compte utilisateur.', 400);
        }

        $db->beginTransaction();
        try {
            $stmtTarget = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1 FOR UPDATE");
            $stmtTarget->execute([$id]);
            $targetUser = $stmtTarget->fetch();

            if (!$targetUser) {
                $db->rollBack();
                Response::error('Utilisateur introuvable.', 404);
            }

            // Empêcher de supprimer le dernier admin
            if ($targetUser['role'] === 'admin') {
                $stmtAdmins = $db->query("SELECT id FROM users WHERE role = 'admin' FOR UPDATE");
                $adminCount = count($stmtAdmins->fetchAll());
                if ($adminCount <= 1) {
                    $db->rollBack();
                    Response::error('Impossible de supprimer le seul administrateur restant.', 400);
                }
            }

            // Réassigner les tâches et questions créées par cet utilisateur vers l'admin connecté
            $db->prepare("UPDATE tasks SET created_by = ? WHERE created_by = ?")->execute([$currentUser['id'], $id]);
            $db->prepare("UPDATE questions SET created_by = ? WHERE created_by = ?")->execute([$currentUser['id'], $id]);

            // Nettoyer les sessions
            $db->prepare("DELETE FROM user_sessions WHERE user_id = ?")->execute([$id]);

            // Supprimer l'utilisateur
            $db->prepare("DELETE FROM users WHERE id = ?")->execute([$id]);

            $db->commit();

            Response::json([
                'success' => true,
                'message' => "L'utilisateur {$targetUser['name']} a été supprimé avec succès."
            ]);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('Erreur UserController::delete : ' . $e->getMessage());
            Response::error('Erreur interne lors de la suppression de l\'utilisateur.', 500);
        }
    }
}
