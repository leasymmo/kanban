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
     * Calcule le hash SHA-256 stocké en base pour un token de session.
     */
    public static function hashToken(string $token): string {
        return hash('sha256', $token);
    }

    /**
     * Retourne la durée de validité des sessions (en jours) depuis config.php.
     */
    public static function getSessionLifetimeDays(): int {
        static $days = null;
        if ($days === null) {
            $config = require __DIR__ . '/../config/config.php';
            $days = max(1, (int)($config['app']['session_lifetime_days'] ?? 30));
        }
        return $days;
    }

    /**
     * Pose le cookie HttpOnly de session.
     */
    public static function setSessionCookie(string $token): void {
        setcookie('kanban_token', $token, [
            'expires' => time() + (self::getSessionLifetimeDays() * 86400),
            'path' => '/',
            'secure' => Request::isHttps(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    /**
     * Supprime le cookie de session côté navigateur.
     */
    public static function clearSessionCookie(): void {
        setcookie('kanban_token', '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => Request::isHttps(),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
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
                $host = strtolower(explode(':', $_SERVER['HTTP_HOST'] ?? '')[0]);
                $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
                $referer = trim((string)($_SERVER['HTTP_REFERER'] ?? ''));

                if (strtolower($origin) === 'null') {
                    return null;
                }

                $sourceHost = $origin !== ''
                    ? parse_url($origin, PHP_URL_HOST)
                    : ($referer !== '' ? parse_url($referer, PHP_URL_HOST) : null);

                if ($sourceHost === false || $sourceHost === null || $sourceHost === '') {
                    // Si Origin/Referer sont absents (navigateur strict), exiger un en-tête AJAX custom (bloqué pour les soumissions <form>)
                    if (empty($_SERVER['HTTP_X_REQUESTED_WITH'])) {
                        return null;
                    }
                } elseif ($host !== '' && strtolower((string)$sourceHost) !== $host) {
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
        $tokenHash = self::hashToken($token);

        // Compatibilité descendante : accepte le hash SHA-256 (nouveaux tokens) et l'ancien format brut
        $stmt = $db->prepare("
            SELECT u.id, u.name, u.email, u.role, u.avatar_color, u.initials
            FROM user_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE (s.token = ? OR s.token = ?) AND s.expires_at > NOW()
            LIMIT 1
        ");
        $stmt->execute([$tokenHash, $token]);
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
        
        if ($authHeader && preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
            return $matches[1];
        }

        return null;
    }
}
