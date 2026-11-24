<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use PDO;

class SprintController {
    /**
     * GET /api/sprints
     * Liste tous les sprints avec statistiques
     */
    public function list(): void {
        Auth::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->query("
            SELECT s.*,
                   u.name as closed_by_name,
                   (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id) as total_tasks,
                   (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.status = 'done') as done_tasks,
                   (SELECT COUNT(*) FROM tasks t WHERE t.sprint_id = s.id AND t.status != 'done') as pending_tasks,
                   (SELECT COUNT(*) FROM questions q WHERE q.sprint_id = s.id) as total_questions
            FROM sprints s
            LEFT JOIN users u ON u.id = s.closed_by
            ORDER BY s.number DESC
        ");
        $sprints = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'sprints' => $sprints
        ]);
    }

    /**
     * GET /api/sprints/current
     * Récupère le sprint actif en cours
     */
    public function current(): void {
        Auth::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->query("
            SELECT * FROM sprints
            WHERE status = 'active'
            ORDER BY number DESC
            LIMIT 1
        ");
        $sprint = $stmt->fetch();

        if (!$sprint) {
            // Si aucun sprint n'est actif, on prend le plus récent
            $stmt = $db->query("SELECT * FROM sprints ORDER BY number DESC LIMIT 1");
            $sprint = $stmt->fetch();
        }

        if (!$sprint) {
            Response::error('Aucun sprint configuré', 404);
        }

        Response::json([
            'success' => true,
            'sprint' => $sprint
        ]);
    }

    /**
     * GET /api/sprints/{id}
     * Détail d'un sprint complet (avec tâches, sous-tâches, questions)
     */
    public function get(int $id): void {
        $currentUser = Auth::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM sprints WHERE id = ?");
        $stmt->execute([$id]);
        $sprint = $stmt->fetch();

        if (!$sprint) {
            Response::error('Sprint introuvable', 404);
        }

        // Récupération des tâches du sprint
        $stmtTasks = $db->prepare("
            SELECT t.*,
                   p.name as property_name, p.color as property_color, p.code as property_code,
                   ua.name as assigned_to_name, ua.initials as assigned_to_initials, ua.avatar_color as assigned_to_color,
                   uc.name as created_by_name, uc.initials as created_by_initials
            FROM tasks t
            LEFT JOIN properties p ON p.id = t.property_id
            LEFT JOIN users ua ON ua.id = t.assigned_to
            JOIN users uc ON uc.id = t.created_by
            WHERE t.sprint_id = ?
            ORDER BY t.position ASC, t.id ASC
        ");
        $stmtTasks->execute([$id]);
        $tasks = $stmtTasks->fetchAll();

        // Récupération de toutes les sous-tâches du sprint
        $taskIds = array_column($tasks, 'id');
        $subtasksMap = [];
        if (!empty($taskIds)) {
            $inClause = implode(',', array_fill(0, count($taskIds), '?'));
            $stmtSub = $db->prepare("
                SELECT * FROM subtasks
                WHERE task_id IN ($inClause)
                ORDER BY position ASC, id ASC
            ");
            $stmtSub->execute($taskIds);
            while ($sub = $stmtSub->fetch()) {
                $subtasksMap[$sub['task_id']][] = $sub;
            }
        }

        // Attachement des sous-tâches et calcul des droits d'édition
        foreach ($tasks as &$task) {
            $task['subtasks'] = $subtasksMap[$task['id']] ?? [];
            $task['can_edit'] = ($currentUser['role'] === 'admin')
                || ($currentUser['role'] === 'write' && (
                    $task['assigned_to'] == $currentUser['id']
                    || ($task['assigned_to'] === null && $task['created_by'] == $currentUser['id'])
                ));
            $task['can_delete'] = $task['can_edit'];
            $task['can_assign'] = ($currentUser['role'] === 'admin');
        }

        // Récupération des questions du sprint
        $stmtQ = $db->prepare("
            SELECT q.*,
                   u.name as user_name, u.initials as user_initials, u.avatar_color as user_color,
                   uc.name as created_by_name,
                   ua.name as answered_by_name
            FROM questions q
            JOIN users u ON u.id = q.user_id
            JOIN users uc ON uc.id = q.created_by
            LEFT JOIN users ua ON ua.id = q.answered_by
            WHERE q.sprint_id = ?
            ORDER BY q.user_id ASC, q.id ASC
        ");
        $stmtQ->execute([$id]);
        $questions = $stmtQ->fetchAll();

        // Récupération des réponses collaboratives
        $qIds = array_column($questions, 'id');
        $answersMap = [];
        if (!empty($qIds)) {
            $inClause = implode(',', array_fill(0, count($qIds), '?'));
            $stmtAnswers = $db->prepare("
                SELECT a.*, u.name as user_name, u.initials as user_initials, u.avatar_color as user_color
                FROM question_answers a
                JOIN users u ON u.id = a.user_id
                WHERE a.question_id IN ($inClause)
                ORDER BY a.created_at ASC, a.id ASC
            ");
            $stmtAnswers->execute($qIds);
            while ($ans = $stmtAnswers->fetch()) {
                $answersMap[$ans['question_id']][] = $ans;
            }
        }

        foreach ($questions as &$q) {
            $q['can_edit'] = ($currentUser['role'] === 'admin')
                || ($currentUser['role'] === 'write' && $q['user_id'] == $currentUser['id']);
            $q['can_delete'] = $q['can_edit'];

            $rawAnswers = $answersMap[$q['id']] ?? [];
            foreach ($rawAnswers as &$ans) {
                $ans['can_edit'] = ($currentUser['role'] === 'admin') || ($ans['user_id'] == $currentUser['id']);
                $ans['can_delete'] = $ans['can_edit'];
            }
            $q['answers'] = $rawAnswers;
        }

        Response::json([
            'success' => true,
            'sprint' => $sprint,
            'tasks' => $tasks,
            'questions' => $questions,
            'is_read_only' => ($sprint['status'] === 'closed' && $currentUser['role'] !== 'admin')
        ]);
    }

    /**
     * POST /api/sprints/{id}/close
     * Clôture du sprint et bascule vers le nouveau sprint
     * RÈGLE CLÉ DU BRIEF :
     * 1. Clôture du sprint actif
     * 2. Création du sprint suivant
     * 3. Report des tâches non terminées (status != 'done') avec TOUTES leurs sous-tâches
     *    (les sous-tâches cochées restent cochées !)
     * 4. Les tâches terminées sont archivées avec le sprint clos
     */
    public function close(int $id): void {
        $adminUser = Auth::requireAdmin();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM sprints WHERE id = ?");
        $stmt->execute([$id]);
        $sprint = $stmt->fetch();

        if (!$sprint) {
            Response::error('Sprint introuvable', 404);
        }

        if ($sprint['status'] === 'closed') {
            Response::error('Ce sprint est déjà clôturé', 400);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $nextNumber = $sprint['number'] + 1;
        $nextName = trim($body['next_name'] ?? '') ?: ("Point " . $nextNumber . " — " . date('d M Y'));

        $db->beginTransaction();

        try {
            // 1. Clôture du sprint actuel
            $stmtClose = $db->prepare("
                UPDATE sprints
                SET status = 'closed', closed_at = NOW(), closed_by = ?, notes = ?
                WHERE id = ?
            ");
            $stmtClose->execute([
                $adminUser['id'],
                $body['notes'] ?? 'Clôturé en fin de réunion hebdomadaire',
                $id
            ]);

            // 2. Création du sprint suivant
            $stmtNew = $db->prepare("
                INSERT INTO sprints (number, name, status, started_at, notes)
                VALUES (?, ?, 'active', NOW(), ?)
            ");
            $stmtNew->execute([
                $nextNumber,
                $nextName,
                'Créé automatiquement lors de la bascule du Point ' . $sprint['number']
            ]);
            $newSprintId = (int)$db->lastInsertId();

            // 3. Récupération des tâches NON TERMINÉES du sprint clôturé
            $stmtPendingTasks = $db->prepare("
                SELECT * FROM tasks
                WHERE sprint_id = ? AND status != 'done'
                ORDER BY position ASC, id ASC
            ");
            $stmtPendingTasks->execute([$id]);
            $pendingTasks = $stmtPendingTasks->fetchAll();

            $rolledOverTasksCount = 0;
            $rolledOverSubtasksCount = 0;

            $stmtInsertTask = $db->prepare("
                INSERT INTO tasks (
                    sprint_id, title, description, status, assigned_to, created_by,
                    property_id, priority, due_date, position, is_unplanned, parent_task_id
                ) VALUES (
                    ?, ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, 0, ?
                )
            ");

            $stmtGetSubtasks = $db->prepare("
                SELECT * FROM subtasks
                WHERE task_id = ?
                ORDER BY parent_id ASC, position ASC, id ASC
            ");

            $stmtInsertSubtask = $db->prepare("
                INSERT INTO subtasks (task_id, parent_id, title, is_done, position)
                VALUES (?, ?, ?, ?, ?)
            ");

            foreach ($pendingTasks as $oldTask) {
                // Si la tâche était en statut 'todo', on la laisse en 'in_progress' ou son statut actuel
                $statusToKeep = ($oldTask['status'] === 'todo') ? 'in_progress' : $oldTask['status'];

                $stmtInsertTask->execute([
                    $newSprintId,
                    $oldTask['title'],
                    $oldTask['description'],
                    $statusToKeep,
                    $oldTask['assigned_to'],
                    $oldTask['created_by'],
                    $oldTask['property_id'],
                    $oldTask['priority'],
                    $oldTask['due_date'],
                    $oldTask['position'],
                    $oldTask['id'] // parent_task_id pour traçabilité
                ]);
                $newTaskId = (int)$db->lastInsertId();
                $rolledOverTasksCount++;

                // Report de TOUTES les sous-tâches (faites ou non) avec préservation exacte de la hiérarchie parent/enfant
                $stmtGetSubtasks->execute([$oldTask['id']]);
                $oldSubtasks = $stmtGetSubtasks->fetchAll();

                $subtaskIdMap = [];
                $remaining = $oldSubtasks;
                $maxIterations = 10;
                $iter = 0;

                while (!empty($remaining) && $iter < $maxIterations) {
                    $nextRemaining = [];
                    $iter++;
                    foreach ($remaining as $sub) {
                        $oldParentId = !empty($sub['parent_id']) ? (int)$sub['parent_id'] : null;
                        if ($oldParentId === null || isset($subtaskIdMap[$oldParentId])) {
                            $newParentId = $oldParentId ? $subtaskIdMap[$oldParentId] : null;
                            $stmtInsertSubtask->execute([
                                $newTaskId,
                                $newParentId,
                                $sub['title'],
                                $sub['is_done'], // Conserve l'état validé ou non
                                $sub['position']
                            ]);
                            $subtaskIdMap[$sub['id']] = (int)$db->lastInsertId();
                            $rolledOverSubtasksCount++;
                        } else {
                            $nextRemaining[] = $sub;
                        }
                    }
                    if (count($nextRemaining) === count($remaining)) {
                        // Cas exceptionnel d'orphelin : insérer à la racine pour éviter toute perte
                        foreach ($nextRemaining as $orphan) {
                            $stmtInsertSubtask->execute([
                                $newTaskId,
                                null,
                                $orphan['title'],
                                $orphan['is_done'],
                                $orphan['position']
                            ]);
                            $subtaskIdMap[$orphan['id']] = (int)$db->lastInsertId();
                            $rolledOverSubtasksCount++;
                        }
                        break;
                    }
                    $remaining = $nextRemaining;
                }
            }

            $db->commit();

            Response::json([
                'success' => true,
                'message' => "Le sprint Point {$sprint['number']} a été clôturé. Le nouveau sprint Point {$nextNumber} est maintenant ouvert.",
                'new_sprint_id' => $newSprintId,
                'stats' => [
                    'tasks_rolled_over' => $rolledOverTasksCount,
                    'subtasks_rolled_over' => $rolledOverSubtasksCount
                ]
            ]);

        } catch (\Exception $e) {
            $db->rollBack();
            Response::error('Erreur lors de la bascule du sprint : ' . $e->getMessage(), 500);
        }
    }
}
