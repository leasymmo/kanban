<?php

namespace App;

/**
 * Helpers centralisés pour la lecture et la validation des requêtes HTTP entrantes.
 */
class Request {
    /**
     * Décode le corps JSON de la requête en tableau associatif.
     * Rejette les charges utiles malformées ou non-objets (scalaires) avec un HTTP 400.
     */
    public static function jsonBody(): array {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
            Response::error('Corps de requête JSON invalide.', 400);
        }

        return $decoded;
    }

    /**
     * Extrait une chaîne nettoyée sans risquer de TypeError si le client passe un tableau/scalaire.
     */
    public static function string(array $body, string $key, string $default = '', bool $trim = true): string {
        if (!array_key_exists($key, $body) || $body[$key] === null) {
            return $default;
        }
        if (is_array($body[$key]) || is_object($body[$key])) {
            Response::error("Le champ « {$key} » doit être une chaîne de caractères.", 400);
        }
        $val = (string)$body[$key];
        return $trim ? trim($val) : $val;
    }

    /**
     * Détecte si la requête courante arrive en HTTPS (direct ou derrière un reverse-proxy).
     */
    public static function isHttps(): bool {
        if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
            return true;
        }
        if ((int)($_SERVER['SERVER_PORT'] ?? 0) === 443) {
            return true;
        }
        $forwardedProto = strtolower(trim((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')));
        return $forwardedProto === 'https';
    }
}
