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
            // Lecture rapide en 1 requête des migrations appliquées (évite tout DDL en régime nominal)
            $appliedVersions = [];
            try {
                $rows = $db->query("SELECT version FROM schema_migrations")->fetchAll(PDO::FETCH_COLUMN);
                $appliedVersions = array_flip($rows);
            } catch (\Throwable $t) {
                $db->exec("
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                        version VARCHAR(32) PRIMARY KEY,
                        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");
            }

            if (isset($appliedVersions['v3_sprint_tasks'], $appliedVersions['v4_property_soft_delete'], $appliedVersions['v5_property_position'], $appliedVersions['v6_subtask_sprint_states'], $appliedVersions['v7_sprint_tasks_assigned_to'], $appliedVersions['v8_meeting_pending_tasks'], $appliedVersions['v9_sprint_pending_status'], $appliedVersions['v10_unassigned_tasks_pending'], $appliedVersions['v11_questions_simplify_unique_answers'])) {
                return;
            }

            if (!isset($appliedVersions['v3_sprint_tasks'])) {

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

            // 5. Table d'association N-N sprint_tasks
            $hasSprintTasks = $db->query("SHOW TABLES LIKE 'sprint_tasks'")->fetchAll();
            if (empty($hasSprintTasks)) {
                $colsTasks = $db->query("SHOW COLUMNS FROM tasks LIKE 'is_starred'")->fetchAll();
                if (empty($colsTasks)) {
                    $hasUnplanned = $db->query("SHOW COLUMNS FROM tasks LIKE 'is_unplanned'")->fetchAll();
                    if (!empty($hasUnplanned)) {
                        $db->exec("ALTER TABLE tasks ADD COLUMN is_starred TINYINT(1) NOT NULL DEFAULT 0 AFTER is_unplanned");
                    }
                }

                $db->exec("
                    CREATE TABLE IF NOT EXISTS sprint_tasks (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        sprint_id INT NOT NULL,
                        task_id INT NOT NULL,
                        status ENUM('todo', 'in_progress', 'blocked', 'done') NOT NULL DEFAULT 'todo',
                        position INT NOT NULL DEFAULT 0,
                        is_unplanned TINYINT(1) NOT NULL DEFAULT 0,
                        is_starred TINYINT(1) NOT NULL DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE KEY uniq_sprint_task (sprint_id, task_id),
                        FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
                        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");

                $hasSprintIdCol = $db->query("SHOW COLUMNS FROM tasks LIKE 'sprint_id'")->fetchAll();
                if (!empty($hasSprintIdCol)) {
                    $db->exec("
                        INSERT IGNORE INTO sprint_tasks (sprint_id, task_id, status, position, is_unplanned, is_starred)
                        SELECT sprint_id, id, status, position, COALESCE(is_unplanned, 0), COALESCE(is_starred, 0)
                        FROM tasks
                        WHERE sprint_id IS NOT NULL
                    ");

                    try {
                        $fkStmt = $db->query("
                            SELECT CONSTRAINT_NAME
                            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'tasks'
                              AND COLUMN_NAME = 'sprint_id'
                              AND REFERENCED_TABLE_NAME IS NOT NULL
                        ");
                        foreach ($fkStmt->fetchAll(PDO::FETCH_COLUMN) as $fkName) {
                            $db->exec("ALTER TABLE `tasks` DROP FOREIGN KEY `{$fkName}`");
                        }
                        $db->exec("ALTER TABLE tasks DROP COLUMN sprint_id");
                    } catch (\Throwable $t) {
                        try {
                            $db->exec("ALTER TABLE tasks MODIFY COLUMN sprint_id INT NULL DEFAULT NULL");
                        } catch (\Throwable $t2) {}
                    }

                    foreach (['status', 'position', 'is_unplanned', 'is_starred'] as $legacyCol) {
                        try {
                            $colCheck = $db->query("SHOW COLUMNS FROM tasks LIKE '{$legacyCol}'")->fetchAll();
                            if (!empty($colCheck)) {
                                $db->exec("ALTER TABLE tasks DROP COLUMN `{$legacyCol}`");
                            }
                        } catch (\Throwable $t) {}
                    }
                }
            }

            // 6. Réparation unique des mots de passe issus de l'ancien seed factice
            try {
                $dummyHash = '$2y$10$wKz0b9lM9V5bYI.m9Hn42OKxJ4qZJomk8f2aG4R1qO7C0YhT1K1wS';
                $legacyUsers = $db->query("SELECT id FROM users WHERE password_hash = '$dummyHash' OR LENGTH(password_hash) < 50")->fetchAll();
                if (!empty($legacyUsers)) {
                    $realHash = password_hash('password123', PASSWORD_BCRYPT);
                    $upd = $db->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
                    foreach ($legacyUsers as $lu) {
                        $upd->execute([$realHash, $lu['id']]);
                    }
                }
            } catch (\Throwable $t) {}

            $db->prepare("INSERT IGNORE INTO schema_migrations (version) VALUES (?)")->execute(['v3_sprint_tasks']);
            }

            if (!isset($appliedVersions['v4_property_soft_delete'])) {
                $colsProp = $db->query("SHOW COLUMNS FROM properties LIKE 'deleted_at'")->fetchAll();
                if (empty($colsProp)) {
                    $db->exec("ALTER TABLE properties ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER is_active");
                }
                $db->prepare("INSERT IGNORE INTO schema_migrations (version) VALUES (?)")->execute(['v4_property_soft_delete']);
            }

            if (!isset($appliedVersions['v5_property_position'])) {
                $colsPropPos = $db->query("SHOW COLUMNS FROM properties LIKE 'position'")->fetchAll();
                if (empty($colsPropPos)) {
                    $db->exec("ALTER TABLE properties ADD COLUMN position INT NOT NULL DEFAULT 0 AFTER color");
                    $rows = $db->query("SELECT id FROM properties ORDER BY is_active DESC, name ASC, id ASC")->fetchAll(PDO::FETCH_COLUMN);
                    $upd = $db->prepare("UPDATE properties SET position = ? WHERE id = ?");
                    foreach ($rows as $idx => $propId) {
                        $upd->execute([$idx + 1, $propId]);
                    }
                }
                $db->prepare("INSERT IGNORE INTO schema_migrations (version) VALUES (?)")->execute(['v5_property_position']);
            }

            if (!isset($appliedVersions['v6_subtask_sprint_states'])) {
                $colsCreated = $db->query("SHOW COLUMNS FROM subtasks LIKE 'created_sprint_id'")->fetchAll();
                if (empty($colsCreated)) {
                    $db->exec("ALTER TABLE subtasks ADD COLUMN created_sprint_id INT NULL DEFAULT NULL AFTER position");
                }
                $colsDeleted = $db->query("SHOW COLUMNS FROM subtasks LIKE 'deleted_sprint_id'")->fetchAll();
                if (empty($colsDeleted)) {
                    $db->exec("ALTER TABLE subtasks ADD COLUMN deleted_sprint_id INT NULL DEFAULT NULL AFTER created_sprint_id");
                }

                try {
                    $db->exec("ALTER TABLE subtasks ADD INDEX idx_subtasks_task_pos (task_id, position)");
                } catch (\Throwable $t) {}
                try {
                    $db->exec("ALTER TABLE subtasks ADD CONSTRAINT fk_subtasks_created_sprint FOREIGN KEY (created_sprint_id) REFERENCES sprints(id) ON DELETE SET NULL");
                } catch (\Throwable $t) {}
                try {
                    $db->exec("ALTER TABLE subtasks ADD CONSTRAINT fk_subtasks_deleted_sprint FOREIGN KEY (deleted_sprint_id) REFERENCES sprints(id) ON DELETE SET NULL");
                } catch (\Throwable $t) {}
                try {
                    $db->exec("ALTER TABLE sprint_tasks ADD INDEX idx_sprint_status_pos (sprint_id, status, position)");
                } catch (\Throwable $t) {}

                $db->exec("
                    CREATE TABLE IF NOT EXISTS subtask_sprint_states (
                        subtask_id INT NOT NULL,
                        sprint_id INT NOT NULL,
                        is_done TINYINT(1) NOT NULL DEFAULT 1,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (subtask_id, sprint_id),
                        INDEX idx_sss_sprint (sprint_id),
                        CONSTRAINT fk_sss_subtask FOREIGN KEY (subtask_id) REFERENCES subtasks(id) ON DELETE CASCADE,
                        CONSTRAINT fk_sss_sprint FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                ");

                // Rétro-remplissage du sprint d'origine de chaque sous-tâche existante
                $db->exec("
                    UPDATE subtasks sub
                    SET sub.created_sprint_id = (
                        SELECT s.id
                        FROM sprint_tasks st
                        JOIN sprints s ON s.id = st.sprint_id
                        WHERE st.task_id = sub.task_id
                        ORDER BY s.number ASC, st.id ASC
                        LIMIT 1
                    )
                    WHERE sub.created_sprint_id IS NULL
                ");

                // Rétro-remplissage minimal des états cochés sur les sprints déjà clôturés
                $db->exec("
                    INSERT IGNORE INTO subtask_sprint_states (subtask_id, sprint_id, is_done)
                    SELECT sub.id,
                           (
                               SELECT s.id
                               FROM sprint_tasks st
                               JOIN sprints s ON s.id = st.sprint_id
                               WHERE st.task_id = sub.task_id AND s.status = 'closed'
                               ORDER BY s.number ASC, st.id ASC
                               LIMIT 1
                           ) AS first_closed_sprint_id,
                           1
                    FROM subtasks sub
                    WHERE sub.is_done = 1
                      AND EXISTS (
                          SELECT 1
                          FROM sprint_tasks st
                          JOIN sprints s ON s.id = st.sprint_id
                          WHERE st.task_id = sub.task_id AND s.status = 'closed'
                      )
                ");

                $db->prepare("INSERT IGNORE INTO schema_migrations (version) VALUES (?)")->execute(['v6_subtask_sprint_states']);
            }

            if (!isset($appliedVersions['v7_sprint_tasks_assigned_to'])) {
                $colsStAssigned = $db->query("SHOW COLUMNS FROM sprint_tasks LIKE 'assigned_to'")->fetchAll();
                if (empty($colsStAssigned)) {
                    $db->exec("ALTER TABLE sprint_tasks ADD COLUMN assigned_to INT NULL DEFAULT NULL AFTER status");
                }
                try {
                    $db->exec("ALTER TABLE sprint_tasks ADD INDEX idx_sprint_assigned (sprint_id, assigned_to)");
                } catch (\Throwable $t) {}
                try {
                    $db->exec("ALTER TABLE sprint_tasks ADD CONSTRAINT fk_sprint_tasks_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL");
                } catch (\Throwable $t) {}

                $colsTasksAssigned = $db->query("SHOW COLUMNS FROM tasks LIKE 'assigned_to'")->fetchAll();
                if (!empty($colsTasksAssigned)) {
                    $db->exec("
                        UPDATE sprint_tasks st
                        JOIN tasks t ON t.id = st.task_id
                        SET st.assigned_to = t.assigned_to
                        WHERE st.assigned_to IS NULL AND t.assigned_to IS NOT NULL
                    ");

                    try {
                        $fkStmt = $db->query("
                            SELECT CONSTRAINT_NAME
                            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                            WHERE TABLE_SCHEMA = DATABASE()
                              AND TABLE_NAME = 'tasks'
                              AND COLUMN_NAME = 'assigned_to'
                              AND REFERENCED_TABLE_NAME IS NOT NULL
                        ");
                        foreach ($fkStmt->fetchAll(PDO::FETCH_COLUMN) as $fkName) {
                            $db->exec("ALTER TABLE `tasks` DROP FOREIGN KEY `{$fkName}`");
                        }
                        $db->exec("ALTER TABLE tasks DROP COLUMN assigned_to");
                    } catch (\Throwable $t) {}
                }

                $db->prepare("INSERT IGNORE INTO schema_migrations (version) VALUES (?)")->execute(['v7_sprint_tasks_assigned_to']);
            }

            if (!isset($appliedVersions['v8_meeting_pending_tasks']) || !isset($appliedVersions['v9_sprint_pending_status'])) {
                // Nettoyage d'une éventuelle table transitoire d'une version antérieure
                try {
                    $db->exec("DROP TABLE IF EXISTS sprint_pending_tasks");
                } catch (\Throwable $t) {}

                // Vérifier réellement que l'ENUM status contient 'pending' (v8 avait existé sous une autre forme)
                $statusCol = $db->query("SHOW COLUMNS FROM sprint_tasks LIKE 'status'")->fetch();
                $statusType = (string)($statusCol['Type'] ?? '');
                if (strpos($statusType, "'pending'") === false) {
                    $db->exec("ALTER TABLE sprint_tasks MODIFY COLUMN status ENUM('pending', 'todo', 'in_progress', 'blocked', 'done') NOT NULL DEFAULT 'todo'");
                }

                $colsIsNew = $db->query("SHOW COLUMNS FROM sprint_tasks LIKE 'is_new'")->fetchAll();
                if (empty($colsIsNew)) {
                    $db->exec("ALTER TABLE sprint_tasks ADD COLUMN is_new TINYINT(1) NOT NULL DEFAULT 0 AFTER is_starred");
                }

                $stmtMig = $db->prepare("INSERT IGNORE INTO schema_migrations (version) VALUES (?)");
                $stmtMig->execute(['v8_meeting_pending_tasks']);
                $stmtMig->execute(['v9_sprint_pending_status']);
            }

            if (!isset($appliedVersions['v10_unassigned_tasks_pending'])) {
                $colsMeetingPending = $db->query("SHOW COLUMNS FROM sprint_tasks LIKE 'is_meeting_pending'")->fetchAll();
                if (!empty($colsMeetingPending)) {
                    $db->exec("ALTER TABLE sprint_tasks DROP COLUMN is_meeting_pending");
                }

                // Toutes les tâches non attribuées du sprint en cours passent au statut 'pending'
                $db->exec("
                    UPDATE sprint_tasks st
                    JOIN sprints s ON s.id = st.sprint_id
                    SET st.status = 'pending', st.is_starred = 0
                    WHERE s.status = 'active'
                      AND st.assigned_to IS NULL
                      AND st.status != 'pending'
                ");

                $db->prepare("INSERT IGNORE INTO schema_migrations (version) VALUES (?)")->execute(['v10_unassigned_tasks_pending']);
            }

            if (!isset($appliedVersions['v11_questions_simplify_unique_answers'])) {
                // 1. Supprimer les éventuelles contraintes FK sur questions.answered_by
                try {
                    $fkStmt = $db->query("
                        SELECT CONSTRAINT_NAME
                        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = 'questions'
                          AND COLUMN_NAME = 'answered_by'
                          AND REFERENCED_TABLE_NAME IS NOT NULL
                    ");
                    foreach ($fkStmt->fetchAll(PDO::FETCH_COLUMN) as $fkName) {
                        $db->exec("ALTER TABLE `questions` DROP FOREIGN KEY `{$fkName}`");
                    }
                } catch (\Throwable $t) {
                    error_log('Migration v11 drop FK answered_by: ' . $t->getMessage());
                }

                // 2. Supprimer les colonnes obsolètes status, answered_by, answered_at sur questions
                foreach (['status', 'answered_by', 'answered_at'] as $colToDrop) {
                    $colExists = $db->query("SHOW COLUMNS FROM questions LIKE '{$colToDrop}'")->fetchAll();
                    if (!empty($colExists)) {
                        $db->exec("ALTER TABLE `questions` DROP COLUMN `{$colToDrop}`");
                    }
                }

                // 3. Purger les réponses indicatives des sprints déjà clôturés
                $db->exec("
                    DELETE qa
                    FROM question_answers qa
                    INNER JOIN questions q ON q.id = qa.question_id
                    INNER JOIN sprints s ON s.id = q.sprint_id
                    WHERE s.status = 'closed'
                ");

                // 4. Dédoublonner question_answers avant d'appliquer l'unicité (1 réponse max / associé / question)
                $db->exec("
                    DELETE qa1
                    FROM question_answers qa1
                    INNER JOIN question_answers qa2
                      ON qa1.question_id = qa2.question_id
                     AND qa1.user_id = qa2.user_id
                     AND (
                         qa1.updated_at < qa2.updated_at
                         OR (qa1.updated_at = qa2.updated_at AND qa1.id < qa2.id)
                     )
                ");

                // 5. Index unique (question_id, user_id)
                $idxExists = $db->query("SHOW INDEX FROM question_answers WHERE Key_name = 'uniq_question_user'")->fetchAll();
                if (empty($idxExists)) {
                    $db->exec("ALTER TABLE `question_answers` ADD UNIQUE KEY `uniq_question_user` (`question_id`, `user_id`)");
                }

                $db->prepare("INSERT IGNORE INTO schema_migrations (version) VALUES (?)")->execute(['v11_questions_simplify_unique_answers']);
            }
        } catch (\Throwable $e) {
            error_log('Database::migrateSchema error: ' . $e->getMessage());
        }
    }
}
