<?php
/**
 * Configuration de l'application & de la base de données
 */

// Chargement automatique d'un fichier .env s'il existe (à la racine ou dans backend/)
$possibleEnvFiles = [
    __DIR__ . '/../../.env',
    __DIR__ . '/../.env',
    __DIR__ . '/.env'
];

foreach ($possibleEnvFiles as $envFile) {
    if (file_exists($envFile)) {
        $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || strpos($line, '#') === 0) continue;
            if (strpos($line, '=') !== false) {
                [$key, $value] = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);
                // Retrait des guillemets éventuels
                $value = trim($value, '"\'');
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
        break;
    }
}

return [
    'driver' => getenv('DB_DRIVER') ?: 'mysql',
    'mysql' => [
        'host' => getenv('DB_HOST') ?: 'localhost',
        'database' => getenv('DB_NAME') ?: 'kanban',
        'username' => getenv('DB_USER') ?: 'root',
        'password' => getenv('DB_PASSWORD') ?: '',
        'charset' => 'utf8mb4',
    ],
    'sqlite' => [
        'path' => __DIR__ . '/../database/kanban.sqlite',
    ],
    'app' => [
        'env' => getenv('APP_ENV') ?: 'production',
        'session_lifetime_days' => (int)(getenv('SESSION_LIFETIME_DAYS') ?: 30),
    ]
];
