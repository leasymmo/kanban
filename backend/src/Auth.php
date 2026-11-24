<?php

namespace App;

use PDO;

class Auth {
    /**
     * Génère un token aléatoire sécurisé
     */
    public static function generateToken(): string {
        return bin2hex(random_bytes(32));
    }

    /**
     * Récupère l'utilisateur actuellement authentifié via le Bearer Token ou le Cookie
     */
    public static function getCurrentUser(): ?array {
        $token = self::getBearerToken();
        if (!$token && isset($_COOKIE['kanban_token'])) {
            $token = $_COOKIE['kanban_token'];
        }

        if (!$token) {
            return null;
        }

        $db = Database::getConnection();
        $stmt = $db->prepare("
            SELECT u.id, u.name, u.email, u.role, u.avatar_color, u.initials
            FROM user_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ? AND s.expires_at > NOW()
            LIMIT 1
        ");
        $stmt->execute([$token]);
        $user = $stmt->fetch();

        return $user ?: null;
    }

    /**
     * Exige une authentification valide, sinon renvoie 401
     */
    public static function requireAuth(): array {
        $user = self::getCurrentUser();
        if (!$user) {
            Response::error('Non authentifié. Veuillez vous connecter.', 401);
        }
        return $user;
    }

    /**
     * Exige le rôle Admin
     */
    public static function requireAdmin(): array {
        $user = self::requireAuth();
        if ($user['role'] !== 'admin') {
            Response::error('Action réservée aux administrateurs.', 403);
        }
        return $user;
    }

    /**
     * Exige au minimum le rôle Écriture ou Admin
     */
    public static function requireWrite(): array {
        $user = self::requireAuth();
        if ($user['role'] === 'read') {
            Response::error('Votre compte est en lecture seule.', 403);
        }
        return $user;
    }

    private static function getBearerToken(): ?string {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? null;
        
        if ($authHeader && preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }

        return null;
    }
}
