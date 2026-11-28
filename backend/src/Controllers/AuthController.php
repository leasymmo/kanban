<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use App\Request;

class AuthController {
    // Hash factice valide utilisé pour égaliser le temps de réponse quand l'utilisateur n'existe pas
    private const DUMMY_BCRYPT_HASH = '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';

    /**
     * POST /api/auth/login
     * Body: { "email": "...", "password": "..." } ou { "user_id": 1, "password": "..." }
     */
    public function login(): void {
        $body = Request::jsonBody();
        $email = strtolower(Request::string($body, 'email'));
        $userId = isset($body['user_id']) && is_numeric($body['user_id']) ? (int)$body['user_id'] : null;
        $password = Request::string($body, 'password', '', false);

        if ($password === '') {
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
        } catch (\Throwable $t) {
            error_log('AuthController::login rate-limit check failed: ' . $t->getMessage());
        }

        if ($userId !== null && $userId > 0) {
            $stmt = $db->prepare("SELECT * FROM users WHERE id = ? LIMIT 1");
            $stmt->execute([$userId]);
        } else if ($email !== '') {
            $stmt = $db->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
            $stmt->execute([$email]);
        } else {
            Response::error('Identifiant ou email requis', 400);
        }

        $user = $stmt->fetch();
        if (!$user) {
            password_verify($password, self::DUMMY_BCRYPT_HASH);
            try {
                $db->prepare("INSERT INTO login_attempts (ip_address) VALUES (?)")->execute([$ip]);
            } catch (\Throwable $t) {
                error_log('AuthController::login attempt log failed: ' . $t->getMessage());
            }
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
        } else if (hash_equals($user['password_hash'], hash('sha256', $password))) {
            $passwordValid = true;
            $newHash = password_hash($password, PASSWORD_BCRYPT);
            $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?")->execute([$newHash, $user['id']]);
        }

        if (!$passwordValid) {
            try {
                $db->prepare("INSERT INTO login_attempts (ip_address) VALUES (?)")->execute([$ip]);
            } catch (\Throwable $t) {
                error_log('AuthController::login attempt log failed: ' . $t->getMessage());
            }
            Response::error('Identifiants incorrects', 401);
        }

        // Connexion réussie : effacer les tentatives échouées de cette IP
        try {
            $db->prepare("DELETE FROM login_attempts WHERE ip_address = ?")->execute([$ip]);
        } catch (\Throwable $t) {
            error_log('AuthController::login attempt clear failed: ' . $t->getMessage());
        }

        // Création du token de session (stocké hashé en SHA-256 en base)
        $token = Auth::generateToken();
        $tokenHash = Auth::hashToken($token);
        $lifetimeDays = Auth::getSessionLifetimeDays();

        $stmtSession = $db->prepare("
            INSERT INTO user_sessions (user_id, token, expires_at)
            VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))
        ");
        $stmtSession->execute([$user['id'], $tokenHash, $lifetimeDays]);

        Auth::setSessionCookie($token);
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
            $stmt = $db->prepare("DELETE FROM user_sessions WHERE token = ? OR token = ?");
            $stmt->execute([Auth::hashToken($token), $token]);
        }

        Auth::clearSessionCookie();
        Response::success(null, 'Déconnexion effectuée');
    }
}
