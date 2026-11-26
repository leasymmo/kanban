<?php

namespace App;

class Response {
    public static function sendCorsHeaders(): void {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        $host = $_SERVER['HTTP_HOST'] ?? '';

        if ($origin !== '') {
            $parsedOriginHost = parse_url($origin, PHP_URL_HOST);
            $serverHostOnly = $host !== '' ? explode(':', $host)[0] : '';

            $isLocalDev = in_array($parsedOriginHost, ['localhost', '127.0.0.1'], true);
            $isSameHost = ($serverHostOnly !== '' && $parsedOriginHost === $serverHostOnly);

            if ($isSameHost || $isLocalDev) {
                header("Access-Control-Allow-Origin: {$origin}");
                header('Access-Control-Allow-Credentials: true');
                header('Vary: Origin');
            }
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    }

    public static function json($data, int $statusCode = 200): void {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        self::sendCorsHeaders();
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('Referrer-Policy: strict-origin-when-cross-origin');

        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function error(string $message, int $statusCode = 400, $details = null): void {
        self::json([
            'success' => false,
            'error' => $message,
            'details' => $details
        ], $statusCode);
    }

    public static function success($data = null, string $message = 'Opération réussie'): void {
        self::json([
            'success' => true,
            'message' => $message,
            'data' => $data
        ]);
    }
}
