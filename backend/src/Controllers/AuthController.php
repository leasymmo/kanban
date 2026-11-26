<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use PDO;

class AuthController {
    /**
     * POST /api/auth/login
     * Body: { "email": "...", "password": "..." } ou { "user_id": 1, "password": "..." }
     */
    public function login(): void {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = trim($body['email'] ?? '');
        $userId = $body['user_id'] ?? null;
        $password = $body['password'] ?? '';

        if (empty($password)) {
            Response::error('Mot de passe requis', 400);
        }

        $db = Database::getConnection();
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

        // Protection force-brute : max 10 tentatives échouées par tranche de 10 minutes par IP
        try {
            if (mt_rand(1, 20) === 1) {
                $db->exec("DELETE FROM login_attempts WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)");
                $db->exec("DELETE FROM user_sessions WHERE expires_at <= NOW()");
            }
            $stmtAttempts = $db->prepare("
                SELECT COUNT(*) FROM login_attempts
                WHERE ip_address = ? AND attempted_at > DATE_SUB(NOW(), INTERVAL 10 MINUTE)
            ");
            $stmtAttempts->execute([$ip]);
            $failCount = (int)$stmtAttempts->fetchColumn();

            if ($failCount >= 10) {
                Response::error('Trop de tentatives de connexion échouées. Veuillez patienter quelques minutes.', 429);
            }
        } catch (\Throwable $t) {}
        
        if ($userId) {
            $stmt = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([(int)$userId]);
        } else if (!empty($email)) {
            $stmt = $db->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
            $stmt->execute([$email]);
        } else {
            Response::error('Identifiant ou email requis', 400);
        }

        $user = $stmt->fetch();
        if (!$user) {
            try {
                $db->prepare("INSERT INTO login_attempts (ip_address) VALUES (?)")->execute([$ip]);
            } catch (\Throwable $t) {}
            Response::error('Identifiants incorrects', 401);
        }

        // Vérification sécurisée du mot de passe
        $passwordValid = false;

        if (password_verify($password, $user['password_hash'])) {
            $passwordValid = true;
            if (password_needs_rehash($user['password_hash'], PASSWORD_BCRYPT)) {
                $newHash = password_hash($password, PASSWORD_BCRYPT);
                $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$newHash, $user['id']]);
            }
        } else if (hash('sha256', $password) === $user['password_hash']) {
            $passwordValid = true;
            $newHash = password_hash($password, PASSWORD_BCRYPT);
            $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$newHash, $user['id']]);
        }

        if (!$passwordValid) {
            try {
                $db->prepare("INSERT INTO login_attempts (ip_address) VALUES (?)")->execute([$ip]);
            } catch (\Throwable $t) {}
            Response::error('Identifiants incorrects', 401);
        }

        // Connexion réussie : effacer les tentatives échouées de cette IP
        try {
            $db->prepare("DELETE FROM login_attempts WHERE ip_address = ?")->execute([$ip]);
        } catch (\Throwable $t) {}

        // Création du token de session
        $token = Auth::generateToken();
        $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

        $stmtSession = $db->prepare("
            INSERT INTO user_sessions (user_id, token, expires_at)
            VALUES (?, ?, ?)
        ");
        $stmtSession->execute([$user['id'], $token, $expiresAt]);

        // Définition du cookie sécurisé (HttpOnly + Secure si HTTPS)
        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        setcookie('kanban_token', $token, [
            'expires' => strtotime('+30 days'),
            'path' => '/',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);

        unset($user['password_hash']);

        Response::json([
            'success' => true,
            'token' => $token,
            'user' => $user
        ]);
    }

    /**
     * GET /api/auth/me
     */
    public function me(): void {
        $user = Auth::getCurrentUser();
        if (!$user) {
            Response::error('Non connecté', 401);
        }
        Response::json([
            'success' => true,
            'user' => $user
        ]);
    }

    /**
     * POST /api/auth/logout
     */
    public function logout(): void {
        $token = Auth::getTokenFromRequest();
        
        if ($token) {
            $db = Database::getConnection();
            $stmt = $db->prepare("DELETE FROM user_sessions WHERE token = ?");
            $stmt->execute([$token]);
        }

        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        setcookie('kanban_token', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax'
        ]);

        Response::success(null, 'Déconnexion effectuée');
    }
}
