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
     * Extrait le token de la requête (Bearer header ou Cookie)
     */
    public static function getTokenFromRequest(): ?string {
        $bearer = self::getBearerToken();
        if ($bearer) {
            return $bearer;
        }

        if (isset($_COOKIE['kanban_token']) && $_COOKIE['kanban_token'] !== '') {
            // Protection CSRF si l'authentification passe uniquement par cookie sur une requête mutante
            $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
            if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
                $host = explode(':', $_SERVER['HTTP_HOST'] ?? '')[0];
                $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
                $referer = $_SERVER['HTTP_REFERER'] ?? '';
                $sourceHost = $origin !== ''
                    ? parse_url($origin, PHP_URL_HOST)
                    : ($referer !== '' ? parse_url($referer, PHP_URL_HOST) : null);

                if ($host !== '' && $sourceHost !== null && $sourceHost !== $host) {
                    return null;
                }
            }
            return $_COOKIE['kanban_token'];
        }

        return null;
    }

    /**
     * Récupère l'utilisateur actuellement authentifié via le Bearer Token ou le Cookie
     */
    public static function getCurrentUser(): ?array {
        $token = self::getTokenFromRequest();
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
        $authHeader = $headers['Authorization']
            ?? $headers['authorization']
            ?? $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? null;
        
        if ($authHeader && preg_match('/Bearer\s(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }

        return null;
    }
}
