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

                self::migrateSchema(self::$instance);
            } catch (PDOException $e) {
                http_response_code(500);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'error' => 'Erreur de connexion à la base de données',
                    'message' => 'Impossible de joindre le serveur de données SQL.'
                ]);
                exit;
            }
        }

        return self::$instance;
    }

    private static function migrateSchema(PDO $db): void {
        try {
            // 1. Colonne parent_id dans subtasks (sous-tâches récursives)
            $colsSubtasks = $db->query("SHOW COLUMNS FROM subtasks LIKE 'parent_id'")->fetchAll();
            if (empty($colsSubtasks)) {
                $db->exec("ALTER TABLE subtasks ADD COLUMN parent_id INT NULL DEFAULT NULL AFTER task_id");
                try {
                    $db->exec("ALTER TABLE subtasks ADD CONSTRAINT fk_subtasks_parent FOREIGN KEY (parent_id) REFERENCES subtasks(id) ON DELETE CASCADE");
                } catch (\Throwable $t) {}
            }

            // 2. Colonnes pour décision finale dans questions
            $colsQ = $db->query("SHOW COLUMNS FROM questions LIKE 'final_answer'")->fetchAll();
            if (empty($colsQ)) {
                $db->exec("ALTER TABLE questions ADD COLUMN final_answer TEXT NULL DEFAULT NULL AFTER status");
                $db->exec("ALTER TABLE questions ADD COLUMN answered_by INT NULL DEFAULT NULL AFTER final_answer");
                $db->exec("ALTER TABLE questions ADD COLUMN answered_at DATETIME NULL DEFAULT NULL AFTER answered_by");
                try {
                    $db->exec("ALTER TABLE questions ADD CONSTRAINT fk_questions_answered_by FOREIGN KEY (answered_by) REFERENCES users(id) ON DELETE SET NULL");
                } catch (\Throwable $t) {}
            }

            // 3. Table des réponses collaboratives
            $db->exec("
                CREATE TABLE IF NOT EXISTS question_answers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    question_id INT NOT NULL,
                    user_id INT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // 4. Table de limitation des tentatives de connexion (anti force-brute)
            $db->exec("
                CREATE TABLE IF NOT EXISTS login_attempts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    ip_address VARCHAR(45) NOT NULL,
                    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_ip_time (ip_address, attempted_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            // 5. Colonne is_starred dans tasks (mise en avant pour réunion hebdomadaire)
            $colsTasks = $db->query("SHOW COLUMNS FROM tasks LIKE 'is_starred'")->fetchAll();
            if (empty($colsTasks)) {
                $db->exec("ALTER TABLE tasks ADD COLUMN is_starred TINYINT(1) NOT NULL DEFAULT 0 AFTER is_unplanned");
            }
        } catch (\Throwable $e) {
            // Silencieux pour ne pas bloquer les requêtes
        }
    }
}
