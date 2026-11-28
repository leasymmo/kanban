<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use App\Request;
use App\QuestionHelper;
use PDO;

class SprintController {
    /**
     * Liste des sprints avec statistiques agrégées
     */
    public static function fetchSprintsList(PDO $db): array {
        $stmt = $db->query("
            SELECT s.*,
                   u.name as closed_by_name,
                   COALESCE(st_agg.total_tasks, 0) as total_tasks,
                   COALESCE(st_agg.done_tasks, 0) as done_tasks,
                   COALESCE(st_agg.pending_tasks, 0) as pending_tasks,
                   COALESCE(q_agg.total_questions, 0) as total_questions
            FROM sprints s
            LEFT JOIN users u ON u.id = s.closed_by
            LEFT JOIN (
                SELECT sprint_id,
                       SUM(CASE WHEN status != 'pending' THEN 1 ELSE 0 END) as total_tasks,
                       SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_tasks,
                       SUM(CASE WHEN status NOT IN ('done', 'pending') THEN 1 ELSE 0 END) as pending_tasks
                FROM sprint_tasks
                GROUP BY sprint_id
            ) st_agg ON st_agg.sprint_id = s.id
            LEFT JOIN (
                SELECT sprint_id, COUNT(*) as total_questions
                FROM questions
                GROUP BY sprint_id
            ) q_agg ON q_agg.sprint_id = s.id
            ORDER BY s.number DESC
        ");
        return $stmt->fetchAll();
    }

    /**
     * Détail complet (tâches, sous-tâches, questions) pour un sprint donné
     */
    public static function fetchSprintDetailsPayload(PDO $db, array $sprint, array $currentUser): array {
        $id = (int)$sprint['id'];

        $stmtTasks = $db->prepare("
            SELECT t.id, t.title, t.description, t.created_by,
                   t.property_id, t.priority, t.due_date,
                   t.created_at, t.updated_at,
                   st.sprint_id, st.status, st.assigned_to, st.position, st.is_unplanned, st.is_starred, st.is_new,
                   p.name as property_name, p.color as property_color, p.code as property_code,
                   ua.name as assigned_to_name, ua.initials as assigned_to_initials, ua.avatar_color as assigned_to_color,
                   COALESCE(uc.name, 'Ancien associé') as created_by_name,
                   COALESCE(uc.initials, '?') as created_by_initials
            FROM sprint_tasks st
            JOIN tasks t ON t.id = st.task_id
            LEFT JOIN properties p ON p.id = t.property_id
            LEFT JOIN users ua ON ua.id = st.assigned_to
            LEFT JOIN users uc ON uc.id = t.created_by
            WHERE st.sprint_id = ?
            ORDER BY st.position ASC, t.id ASC
        ");
        $stmtTasks->execute([$id]);
        $tasks = $stmtTasks->fetchAll();

        $taskIds = array_column($tasks, 'id');
        $subtasksMap = \App\SubtaskStateHelper::fetchResolvedSubtasksForTasks(
            $db,
            $taskIds,
            $id,
            isset($sprint['number']) ? (int)$sprint['number'] : null,
            $sprint['status'] ?? null
        );

        $isSprintClosed = ($sprint['status'] === 'closed');
        $isAdmin = ($currentUser['role'] === 'admin');
        $isWrite = ($currentUser['role'] === 'write');

        foreach ($tasks as &$task) {
            $task['subtasks'] = $subtasksMap[$task['id']] ?? [];
            $isOwner = ($task['assigned_to'] == $currentUser['id'])
                || ($task['assigned_to'] === null && $task['created_by'] == $currentUser['id']);
            $canModify = $isAdmin || (!$isSprintClosed && $isWrite && $isOwner);

            $task['can_edit'] = $canModify;
            $task['can_delete'] = $canModify;
            $task['can_assign'] = $isAdmin;
            $task['can_star'] = $canModify && ($task['status'] !== 'pending');
        }
        unset($task);

        $questions = QuestionHelper::hydrateQuestionsForSprint(
            $db,
            $id,
            (string)($sprint['status'] ?? 'active'),
            $currentUser
        );

        return [
            'sprint' => $sprint,
            'tasks' => $tasks,
            'questions' => $questions,
            'is_read_only' => ($sprint['status'] === 'closed' && $currentUser['role'] !== 'admin')
        ];
    }

    /**
     * GET /api/sprints
     * Liste tous les sprints avec statistiques
     */
    public function list(): void {
        Auth::requireAuth();
        $db = Database::getConnection();

        Response::json([
            'success' => true,
            'sprints' => self::fetchSprintsList($db)
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

        $payload = self::fetchSprintDetailsPayload($db, $sprint, $currentUser);
        Response::json(array_merge(['success' => true], $payload));
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

        $body = Request::jsonBody();
        $requestedNextName = Request::string($body, 'next_name');
        $notes = Request::string($body, 'notes', 'Clôturé en fin de réunion hebdomadaire');

        $db->beginTransaction();

        try {
            // Verrouiller le sprint cible pour éviter une double clôture concurrente
            $stmt = $db->prepare("SELECT * FROM sprints WHERE id = ? FOR UPDATE");
            $stmt->execute([$id]);
            $sprint = $stmt->fetch();

            if (!$sprint) {
                $db->rollBack();
                Response::error('Sprint introuvable', 404);
            }

            if ($sprint['status'] === 'closed') {
                $db->rollBack();
                Response::error('Ce sprint est déjà clôturé', 400);
            }

            // Calculer MAX(number)+1 (évite une collision UNIQUE après réouverture d'un ancien sprint)
            $nextNumber = (int)$db->query("SELECT COALESCE(MAX(number), 0) + 1 FROM sprints FOR UPDATE")->fetchColumn();
            $nextName = $requestedNextName !== '' ? mb_substr($requestedNextName, 0, 150) : ("Point " . $nextNumber . " — " . date('d M Y'));

            // 0. Figer uniquement les écarts d'état des sous-tâches dans l'archive du sprint clôturé
            \App\SubtaskStateHelper::freezeSprintSubtaskDeltas($db, (int)$id, (int)$sprint['number']);

            // 1. Clôture du sprint actuel
            $stmtClose = $db->prepare("
                UPDATE sprints
                SET status = 'closed', closed_at = NOW(), closed_by = ?, notes = ?
                WHERE id = ?
            ");
            $stmtClose->execute([
                $adminUser['id'],
                $notes,
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

            // 3. Récupération des tâches NON TERMINÉES du sprint clôturé (table N-N sprint_tasks)
            $stmtPendingTasks = $db->prepare("
                SELECT st.id as sprint_task_id, st.task_id, st.status, st.assigned_to, st.position
                FROM sprint_tasks st
                WHERE st.sprint_id = ? AND st.status != 'done'
                ORDER BY st.position ASC, st.id ASC
            ");
            $stmtPendingTasks->execute([$id]);
            $pendingTasks = $stmtPendingTasks->fetchAll();

            $rolledOverTasksCount = 0;
            $rolledOverSubtasksCount = 0;
            $meetingTasksActivated = 0;
            $unassignedPendingMoved = 0;

            $stmtMoveUnassignedPending = $db->prepare("
                UPDATE sprint_tasks
                SET sprint_id = ?, position = ?, is_unplanned = 0, is_starred = 0, is_new = 0
                WHERE id = ?
            ");

            $stmtLinkTask = $db->prepare("
                INSERT INTO sprint_tasks (
                    sprint_id, task_id, status, assigned_to, position, is_unplanned, is_starred, is_new
                ) VALUES (
                    ?, ?, ?, ?, ?, 0, 0, ?
                )
            ");

            // Compter les sous-tâches en une seule requête groupée au lieu de N requêtes
            $subtaskCounts = [];
            $pendingTaskIds = array_values(array_unique(array_map(fn($r) => (int)$r['task_id'], $pendingTasks)));
            if (!empty($pendingTaskIds)) {
                $inClause = implode(',', array_fill(0, count($pendingTaskIds), '?'));
                $stmtCounts = $db->prepare("
                    SELECT task_id, COUNT(*) as cnt
                    FROM subtasks
                    WHERE task_id IN ($inClause) AND deleted_sprint_id IS NULL
                    GROUP BY task_id
                ");
                $stmtCounts->execute($pendingTaskIds);
                foreach ($stmtCounts->fetchAll() as $row) {
                    $subtaskCounts[(int)$row['task_id']] = (int)$row['cnt'];
                }
            }

            $pos = 1;
            foreach ($pendingTasks as $oldSprintTask) {
                $wasPending = ($oldSprintTask['status'] === 'pending');
                $assignedTo = $oldSprintTask['assigned_to'] !== null ? (int)$oldSprintTask['assigned_to'] : null;
                $taskId = (int)$oldSprintTask['task_id'];

                if ($wasPending && $assignedTo === null) {
                    // Tâche pending non attribuée : déplacée sur le nouveau sprint (même ligne sprint_tasks, reste 'pending', sans is_new)
                    $stmtMoveUnassignedPending->execute([
                        $newSprintId,
                        $pos++,
                        (int)$oldSprintTask['sprint_task_id']
                    ]);
                    $unassignedPendingMoved++;
                } else if ($wasPending && $assignedTo !== null) {
                    // Tâche pending attribuée : passe sur le nouveau sprint en 'todo' avec le tag 'Nouveau'
                    $stmtLinkTask->execute([
                        $newSprintId,
                        $taskId,
                        'todo',
                        $assignedTo,
                        $pos++,
                        1
                    ]);
                    $meetingTasksActivated++;
                } else {
                    // Tâche active non terminée : reportée avec son statut exact
                    $stmtLinkTask->execute([
                        $newSprintId,
                        $taskId,
                        $oldSprintTask['status'],
                        $assignedTo,
                        $pos++,
                        0
                    ]);
                    $rolledOverTasksCount++;
                }

                $rolledOverSubtasksCount += ($subtaskCounts[$taskId] ?? 0);
            }

            // 4. Purge des réponses indicatives des questions du sprint clôturé (seules les questions et final_answer sont archivées)
            $stmtPurgeAnswers = $db->prepare("
                DELETE FROM question_answers
                WHERE question_id IN (SELECT id FROM questions WHERE sprint_id = ?)
            ");
            $stmtPurgeAnswers->execute([$id]);
            $purgedAnswersCount = $stmtPurgeAnswers->rowCount();

            $db->commit();

            Response::json([
                'success' => true,
                'message' => "Le sprint Point {$sprint['number']} a été clôturé. Le nouveau sprint Point {$nextNumber} est maintenant ouvert.",
                'new_sprint_id' => $newSprintId,
                'stats' => [
                    'tasks_rolled_over' => $rolledOverTasksCount,
                    'subtasks_rolled_over' => $rolledOverSubtasksCount,
                    'meeting_tasks_activated' => $meetingTasksActivated,
                    'unassigned_pending_moved' => $unassignedPendingMoved,
                    'question_answers_purged' => $purgedAnswersCount
                ]
            ]);

        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('Erreur SprintController::close : ' . $e->getMessage());
            Response::error('Erreur interne lors de la bascule du sprint.', 500);
        }
    }

    /**
     * POST /api/sprints/{id}/reopen
     * Réouvre un sprint fermé par erreur (Admin uniquement)
     */
    public function reopen(int $id): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM sprints WHERE id = ?");
        $stmt->execute([$id]);
        $sprint = $stmt->fetch();

        if (!$sprint) {
            Response::error('Sprint introuvable', 404);
        }

        if ($sprint['status'] === 'active') {
            Response::error('Ce sprint est déjà actif', 400);
        }

        $db->beginTransaction();
        try {
            // Figer les deltas de tout sprint actif avant de le passer en 'closed'
            $stmtActives = $db->prepare("SELECT id, number FROM sprints WHERE status = 'active' AND id != ?");
            $stmtActives->execute([$id]);
            foreach ($stmtActives->fetchAll() as $activeRow) {
                \App\SubtaskStateHelper::freezeSprintSubtaskDeltas($db, (int)$activeRow['id'], (int)$activeRow['number']);
            }

            // Passer tout autre sprint actif en 'closed' pour assurer l'unicité du sprint actif
            $db->exec("UPDATE sprints SET status = 'closed' WHERE status = 'active'");

            // Préserver l'état hérité des sprints clôturés postérieurs (y compris l'ancien sprint actif fraîchement clos)
            \App\SubtaskStateHelper::materializeDownstreamInheritedStates($db, (int)$id, (int)$sprint['number']);

            // Réouvrir le sprint cible
            $stmtReopen = $db->prepare("
                UPDATE sprints
                SET status = 'active', closed_at = NULL, closed_by = NULL
                WHERE id = ?
            ");
            $stmtReopen->execute([$id]);

            // Restaurer subtasks.is_done à l'état résolu du sprint réouvert
            \App\SubtaskStateHelper::restoreReopenedSprintSubtasks($db, (int)$id);

            $db->commit();

            Response::json([
                'success' => true,
                'message' => "Le sprint « {$sprint['name']} » a été réouvert avec succès.",
                'sprint_id' => $id
            ]);
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('Erreur SprintController::reopen : ' . $e->getMessage());
            Response::error('Erreur interne lors de la réouverture du sprint.', 500);
        }
    }

    /**
     * PUT /api/sprints/{id}
     * Modification des métadonnées d'un sprint (Admin uniquement)
     */
    public function update(int $id): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM sprints WHERE id = ?");
        $stmt->execute([$id]);
        $sprint = $stmt->fetch();

        if (!$sprint) {
            Response::error('Sprint introuvable', 404);
        }

        $body = Request::jsonBody();
        $name = array_key_exists('name', $body) ? Request::string($body, 'name') : $sprint['name'];
        $number = array_key_exists('number', $body) ? (int)$body['number'] : (int)$sprint['number'];
        $notes = array_key_exists('notes', $body) ? Request::string($body, 'notes') : $sprint['notes'];
        $rawStartedAt = array_key_exists('started_at', $body) ? Request::string($body, 'started_at') : '';

        if ($name === '' || mb_strlen($name) > 150) {
            Response::error('Le nom du sprint est requis (150 caractères max).', 400);
        }
        if ($number <= 0) {
            Response::error('Le numéro du sprint doit être supérieur à 0.', 400);
        }

        $startedAt = $sprint['started_at'];
        if ($rawStartedAt !== '') {
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $rawStartedAt)) {
                $startedAt = $rawStartedAt . ' 09:00:00';
            } else {
                $dt = \DateTime::createFromFormat('Y-m-d H:i:s', $rawStartedAt);
                if (!$dt || $dt->format('Y-m-d H:i:s') !== $rawStartedAt) {
                    Response::error('Format de date de démarrage invalide.', 400);
                }
                $startedAt = $rawStartedAt;
            }
        }

        $stmtDup = $db->prepare("SELECT id FROM sprints WHERE number = ? AND id != ? LIMIT 1");
        $stmtDup->execute([$number, $id]);
        if ($stmtDup->fetch()) {
            Response::error("Un autre sprint utilise déjà le numéro {$number}.", 409);
        }

        $stmtUp = $db->prepare("
            UPDATE sprints
            SET name = ?, number = ?, notes = ?, started_at = ?
            WHERE id = ?
        ");
        $stmtUp->execute([$name, $number, $notes, $startedAt, $id]);

        Response::success(null, 'Sprint mis à jour avec succès');
    }

    /**
     * DELETE /api/sprints/{id}
     * Suppression d'un sprint (Admin uniquement)
     */
    public function delete(int $id): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM sprints WHERE id = ?");
        $stmt->execute([$id]);
        $sprint = $stmt->fetch();

        if (!$sprint) {
            Response::error('Sprint introuvable', 404);
        }

        // Vérifier s'il reste au moins 1 sprint
        $totalSprints = (int)$db->query("SELECT COUNT(*) FROM sprints")->fetchColumn();
        if ($totalSprints <= 1) {
            Response::error('Impossible de supprimer le dernier sprint restant.', 400);
        }

        $db->beginTransaction();
        try {
            \App\SubtaskStateHelper::materializeDownstreamInheritedStates($db, (int)$id, (int)$sprint['number']);
            \App\SubtaskStateHelper::reassignSubtaskSprintRefsBeforeDelete($db, (int)$id, (int)$sprint['number']);

            $db->prepare("DELETE FROM sprints WHERE id = ?")->execute([$id]);
            $db->exec("DELETE FROM tasks WHERE id NOT IN (SELECT DISTINCT task_id FROM sprint_tasks)");

            // Si le sprint supprimé était actif, réouvrir proprement le dernier sprint existant et restaurer ses sous-tâches
            if ($sprint['status'] === 'active') {
                $nextActive = $db->query("SELECT id, number FROM sprints ORDER BY number DESC LIMIT 1")->fetch();
                if ($nextActive) {
                    $nextActiveId = (int)$nextActive['id'];
                    $nextActiveNumber = (int)$nextActive['number'];

                    $stmtReopenLatest = $db->prepare("
                        UPDATE sprints
                        SET status = 'active', closed_at = NULL, closed_by = NULL
                        WHERE id = ?
                    ");
                    $stmtReopenLatest->execute([$nextActiveId]);

                    // Restaure subtasks.is_done depuis subtask_sprint_states puis nettoie les deltas du sprint réouvert
                    \App\SubtaskStateHelper::restoreReopenedSprintSubtasks($db, $nextActiveId, $nextActiveNumber);
                }
            }

            $db->commit();
            Response::success(null, 'Sprint supprimé avec succès');
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('Erreur SprintController::delete : ' . $e->getMessage());
            Response::error('Erreur interne lors de la suppression du sprint.', 500);
        }
    }
}
