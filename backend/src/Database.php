<?php

namespace App;

use PDO;
use PDOException;

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $config = require __DIR__ . '/../config/config.php';
            if (file_exists(__DIR__ . '/../config/config.local.php')) {
                $localConfig = require __DIR__ . '/../config/config.local.php';
                $config = array_replace_recursive($config, $localConfig);
            }

            $driver = $config['driver'] ?? 'mysql';

            try {
                if ($driver === 'sqlite') {
                    $path = $config['sqlite']['path'];
                    $dir = dirname($path);
                    if (!is_dir($dir)) {
                        mkdir($dir, 0755, true);
                    }
                    self::$instance = new PDO("sqlite:" . $path);
                    self::$instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                    self::$instance->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
                    self::$instance->exec("PRAGMA foreign_keys = ON;");
                } else {
                    $mysql = $config['mysql'];
                    $dsn = sprintf(
                        "mysql:host=%s;dbname=%s;charset=%s",
                        $mysql['host'],
                        $mysql['database'],
                        $mysql['charset'] ?? 'utf8mb4'
                    );
                    self::$instance = new PDO($dsn, $mysql['username'], $mysql['password'], [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
                    ]);
                }
            } catch (PDOException $e) {
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'error' => 'Erreur de connexion à la base de données',
                    'message' => $e->getMessage()
                ]);
                exit;
            }
        }

        return self::$instance;
    }
}
