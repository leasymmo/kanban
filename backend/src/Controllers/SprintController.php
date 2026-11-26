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
                   (SELECT COUNT(*) FROM sprint_tasks st WHERE st.sprint_id = s.id AND st.status != 'pending') as total_tasks,
                   (SELECT COUNT(*) FROM sprint_tasks st WHERE st.sprint_id = s.id AND st.status = 'done') as done_tasks,
                   (SELECT COUNT(*) FROM sprint_tasks st WHERE st.sprint_id = s.id AND st.status NOT IN ('done', 'pending')) as pending_tasks,
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

        // Récupération des tâches du sprint via la table d'association N-N sprint_tasks
        $stmtTasks = $db->prepare("
            SELECT t.id, t.title, t.description, t.created_by,
                   t.property_id, t.priority, t.due_date, t.parent_task_id,
                   t.created_at, t.updated_at,
                   st.sprint_id, st.status, st.assigned_to, st.position, st.is_unplanned, st.is_starred, st.is_new,
                   p.name as property_name, p.color as property_color, p.code as property_code,
                   ua.name as assigned_to_name, ua.initials as assigned_to_initials, ua.avatar_color as assigned_to_color,
                   uc.name as created_by_name, uc.initials as created_by_initials
            FROM sprint_tasks st
            JOIN tasks t ON t.id = st.task_id
            LEFT JOIN properties p ON p.id = t.property_id
            LEFT JOIN users ua ON ua.id = st.assigned_to
            JOIN users uc ON uc.id = t.created_by
            WHERE st.sprint_id = ?
            ORDER BY st.position ASC, t.id ASC
        ");
        $stmtTasks->execute([$id]);
        $tasks = $stmtTasks->fetchAll();

        // Récupération de toutes les sous-tâches du sprint (visibilité et état différentiel si archivé)
        $taskIds = array_column($tasks, 'id');
        $subtasksMap = \App\SubtaskStateHelper::fetchResolvedSubtasksForTasks(
            $db,
            $taskIds,
            (int)$sprint['id'],
            isset($sprint['number']) ? (int)$sprint['number'] : null,
            $sprint['status'] ?? null
        );

        $isSprintClosed = ($sprint['status'] === 'closed');
        $isAdmin = ($currentUser['role'] === 'admin');
        $isWrite = ($currentUser['role'] === 'write');

        // Attachement des sous-tâches et calcul des droits d'édition (sprint clôturé = lecture seule pour non-admins)
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

        // Récupération des questions du sprint
        $stmtQ = $db->prepare("
            SELECT q.*,
                   COALESCE(u.name, 'Ancien associé') as user_name,
                   COALESCE(u.initials, '?') as user_initials,
                   COALESCE(u.avatar_color, '#64748B') as user_color,
                   COALESCE(uc.name, 'Ancien associé') as created_by_name
            FROM questions q
            LEFT JOIN users u ON u.id = q.user_id
            LEFT JOIN users uc ON uc.id = q.created_by
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
                SELECT a.*,
                       COALESCE(u.name, 'Ancien associé') as user_name,
                       COALESCE(u.initials, '?') as user_initials,
                       COALESCE(u.avatar_color, '#64748B') as user_color
                FROM question_answers a
                LEFT JOIN users u ON u.id = a.user_id
                WHERE a.question_id IN ($inClause)
                ORDER BY a.created_at ASC, a.id ASC
            ");
            $stmtAnswers->execute($qIds);
            while ($ans = $stmtAnswers->fetch()) {
                $answersMap[$ans['question_id']][] = $ans;
            }
        }

        foreach ($questions as &$q) {
            $q['id'] = (int)$q['id'];
            $q['sprint_id'] = (int)$q['sprint_id'];
            $q['user_id'] = $q['user_id'] !== null ? (int)$q['user_id'] : null;
            $q['created_by'] = $q['created_by'] !== null ? (int)$q['created_by'] : null;

            $q['can_edit'] = $isAdmin
                || (!$isSprintClosed && $isWrite && $q['user_id'] !== null && $q['user_id'] === (int)$currentUser['id']);
            $q['can_delete'] = $q['can_edit'];
            $q['can_decide'] = $isAdmin || (!$isSprintClosed && $isWrite);

            $rawAnswers = $answersMap[$q['id']] ?? [];
            foreach ($rawAnswers as &$ans) {
                $ans['id'] = (int)$ans['id'];
                $ans['question_id'] = (int)$ans['question_id'];
                $ans['user_id'] = $ans['user_id'] !== null ? (int)$ans['user_id'] : null;
                $ans['can_edit'] = !$isSprintClosed
                    && ($isAdmin || ($isWrite && $ans['user_id'] !== null && $ans['user_id'] === (int)$currentUser['id']));
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
            // 0. Figer uniquement les écarts d'état des sous-tâches dans l'archive du sprint clôturé
            \App\SubtaskStateHelper::freezeSprintSubtaskDeltas($db, (int)$id);

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

            $stmtCountSubtasks = $db->prepare("SELECT COUNT(*) FROM subtasks WHERE task_id = ? AND deleted_sprint_id IS NULL");

            $pos = 1;
            foreach ($pendingTasks as $oldSprintTask) {
                $wasPending = ($oldSprintTask['status'] === 'pending');
                $assignedTo = $oldSprintTask['assigned_to'] !== null ? (int)$oldSprintTask['assigned_to'] : null;

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
                        $oldSprintTask['task_id'],
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
                        $oldSprintTask['task_id'],
                        $oldSprintTask['status'],
                        $assignedTo,
                        $pos++,
                        0
                    ]);
                    $rolledOverTasksCount++;
                }

                // Les sous-tâches restent rattachées à task_id avec leur état exact (faites / à faire)
                $stmtCountSubtasks->execute([$oldSprintTask['task_id']]);
                $rolledOverSubtasksCount += (int)$stmtCountSubtasks->fetchColumn();
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

        } catch (\Exception $e) {
            $db->rollBack();
            error_log('Erreur SprintController::close : ' . $e->getMessage());
            Response::error('Erreur interne lors de la bascule du sprint.', 500);
        }
    }

    /**
     * POST /api/sprints/{id}/reopen
     * Réouvre un sprint fermé par erreur (Admin uniquement)
     */
    public function reopen(int $id): void {
        $currentUser = Auth::requireAdmin();
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
            $db->rollBack();
            error_log('Erreur SprintController::reopen : ' . $e->getMessage());
            Response::error('Erreur interne lors de la réouverture du sprint.', 500);
        }
    }

    /**
     * PUT /api/sprints/{id}
     * Modification des métadonnées d'un sprint (Admin uniquement)
     */
    public function update(int $id): void {
        $currentUser = Auth::requireAdmin();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM sprints WHERE id = ?");
        $stmt->execute([$id]);
        $sprint = $stmt->fetch();

        if (!$sprint) {
            Response::error('Sprint introuvable', 404);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $name = isset($body['name']) ? trim($body['name']) : $sprint['name'];
        $number = isset($body['number']) ? (int)$body['number'] : (int)$sprint['number'];
        $notes = isset($body['notes']) ? trim($body['notes']) : $sprint['notes'];
        $startedAt = !empty($body['started_at']) ? $body['started_at'] : $sprint['started_at'];

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
        $currentUser = Auth::requireAdmin();
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
