<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use App\Request;
use App\SubtaskStateHelper;
use PDO;

class PropertyController {
    /**
     * GET /api/properties
     * Liste des logements (actifs par défaut, ou tous avec ?include_inactive=1)
     */
    public function list(): void {
        Auth::requireAuth();
        $db = Database::getConnection();

        $includeInactive = !empty($_GET['include_inactive']) && $_GET['include_inactive'] !== '0';
        if ($includeInactive) {
            $stmt = $db->query("SELECT * FROM properties ORDER BY is_active DESC, position ASC, name ASC, id ASC");
        } else {
            $stmt = $db->query("SELECT * FROM properties WHERE is_active = 1 ORDER BY position ASC, name ASC, id ASC");
        }
        $properties = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'properties' => $properties
        ]);
    }

    /**
     * POST /api/properties
     * Création d'un hébergement (Admin uniquement)
     */
    public function create(): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $body = Request::jsonBody();
        $name = Request::string($body, 'name');
        $code = strtoupper(Request::string($body, 'code'));
        $color = Request::string($body, 'color', '#3B82F6');

        if ($name === '' || mb_strlen($name) > 100) {
            Response::error("Le nom de l'hébergement est obligatoire (100 caractères max).", 400);
        }

        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
            $color = '#3B82F6';
        }

        if ($code === '') {
            $words = preg_split('/\s+/', $name) ?: [];
            if (count($words) >= 2) {
                $code = strtoupper(mb_substr($words[0], 0, 1) . mb_substr($words[1], 0, 1));
            } else {
                $code = strtoupper(mb_substr($name, 0, 2));
            }
        }
        $code = mb_substr($code, 0, 20);

        $db->beginTransaction();
        try {
            // Vérification d'unicité du nom sous verrou transactionnel
            $stmtCheck = $db->prepare("SELECT id, is_active FROM properties WHERE name = ? LIMIT 1 FOR UPDATE");
            $stmtCheck->execute([$name]);
            $existing = $stmtCheck->fetch();
            if ($existing) {
                $db->rollBack();
                if (empty($existing['is_active'])) {
                    Response::error("Un hébergement désactivé porte déjà ce nom. Vous pouvez le réactiver ou choisir un autre nom.", 409);
                }
                Response::error("Un hébergement porte déjà ce nom.", 409);
            }

            $maxPos = (int)$db->query("SELECT COALESCE(MAX(position), 0) FROM properties FOR UPDATE")->fetchColumn();
            $stmt = $db->prepare("
                INSERT INTO properties (name, code, color, position, is_active, deleted_at)
                VALUES (?, ?, ?, ?, 1, NULL)
            ");
            $stmt->execute([$name, $code ?: null, $color, $maxPos + 1]);
            $newId = (int)$db->lastInsertId();
            $db->commit();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('Erreur PropertyController::create : ' . $e->getMessage());
            Response::error("Erreur interne lors de la création de l'hébergement.", 500);
        }

        $stmtGet = $db->prepare("SELECT * FROM properties WHERE id = ?");
        $stmtGet->execute([$newId]);
        $property = $stmtGet->fetch();

        Response::json([
            'success' => true,
            'message' => "Hébergement « {$name} » créé avec succès.",
            'property' => $property
        ], 201);
    }

    /**
     * PUT /api/properties/{id}
     * Modification d'un hébergement (Admin uniquement)
     */
    public function update(int $id): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $stmtTarget = $db->prepare("SELECT * FROM properties WHERE id = ? LIMIT 1");
        $stmtTarget->execute([$id]);
        $target = $stmtTarget->fetch();
        if (!$target) {
            Response::error('Hébergement introuvable.', 404);
        }

        $body = Request::jsonBody();
        $name = array_key_exists('name', $body) ? Request::string($body, 'name') : $target['name'];
        $code = array_key_exists('code', $body) ? strtoupper(Request::string($body, 'code')) : ($target['code'] ?? '');
        $color = array_key_exists('color', $body) ? Request::string($body, 'color') : ($target['color'] ?? '#3B82F6');

        if ($name === '' || mb_strlen($name) > 100) {
            Response::error("Le nom de l'hébergement est obligatoire (100 caractères max).", 400);
        }

        if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
            $color = $target['color'] ?: '#3B82F6';
        }

        $stmtCheck = $db->prepare("SELECT id FROM properties WHERE name = ? AND id != ? LIMIT 1");
        $stmtCheck->execute([$name, $id]);
        if ($stmtCheck->fetch()) {
            Response::error("Un autre hébergement utilise déjà ce nom.", 409);
        }

        $stmtUp = $db->prepare("
            UPDATE properties
            SET name = ?, code = ?, color = ?
            WHERE id = ?
        ");
        $stmtUp->execute([$name, $code !== '' ? mb_substr($code, 0, 20) : null, $color, $id]);

        $stmtGet = $db->prepare("SELECT * FROM properties WHERE id = ?");
        $stmtGet->execute([$id]);
        $property = $stmtGet->fetch();

        Response::json([
            'success' => true,
            'message' => "Hébergement « {$name} » mis à jour.",
            'property' => $property
        ]);
    }

    /**
     * GET /api/properties/{id}/pending-tasks
     * Liste les tâches non réalisées rattachées à cet hébergement dans le sprint actif
     */
    public function pendingTasks(int $id): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $stmtProp = $db->prepare("SELECT * FROM properties WHERE id = ? LIMIT 1");
        $stmtProp->execute([$id]);
        $property = $stmtProp->fetch();
        if (!$property) {
            Response::error('Hébergement introuvable.', 404);
        }

        $activeSprint = $db->query("SELECT id, name, number FROM sprints WHERE status = 'active' ORDER BY number DESC LIMIT 1")->fetch();
        $tasks = [];

        if ($activeSprint) {
            $stmt = $db->prepare("
                SELECT t.id, t.title, st.status
                FROM sprint_tasks st
                JOIN tasks t ON t.id = st.task_id
                WHERE st.sprint_id = ? AND t.property_id = ? AND st.status != 'done'
                ORDER BY st.position ASC, t.id ASC
            ");
            $stmt->execute([$activeSprint['id'], $id]);
            $tasks = $stmt->fetchAll();
        }

        Response::json([
            'success' => true,
            'active_sprint' => $activeSprint ?: null,
            'tasks' => $tasks
        ]);
    }

    /**
     * POST /api/properties/{id}/deactivate
     * Soft delete d'un hébergement (Admin uniquement).
     * Si des tâches non réalisées existent sur le sprint en cours, exige pending_action = 'detach' | 'delete'.
     */
    public function deactivate(int $id): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $stmtProp = $db->prepare("SELECT * FROM properties WHERE id = ? LIMIT 1");
        $stmtProp->execute([$id]);
        $property = $stmtProp->fetch();
        if (!$property) {
            Response::error('Hébergement introuvable.', 404);
        }

        $body = Request::jsonBody();
        $pendingAction = $body['pending_action'] ?? null;

        $activeSprint = $db->query("SELECT id, name, number FROM sprints WHERE status = 'active' ORDER BY number DESC LIMIT 1")->fetch();
        $pendingTasks = [];

        if ($activeSprint) {
            $stmtPending = $db->prepare("
                SELECT st.id as sprint_task_id, st.sprint_id, st.task_id, st.status, t.title
                FROM sprint_tasks st
                JOIN tasks t ON t.id = st.task_id
                WHERE st.sprint_id = ? AND t.property_id = ? AND st.status != 'done'
                ORDER BY st.position ASC, t.id ASC
            ");
            $stmtPending->execute([$activeSprint['id'], $id]);
            $pendingTasks = $stmtPending->fetchAll();
        }

        if (!empty($pendingTasks) && !in_array($pendingAction, ['detach', 'delete'], true)) {
            Response::json([
                'success' => false,
                'requires_action' => true,
                'error' => 'Des tâches non réalisées sont encore rattachées à cet hébergement dans le sprint en cours.',
                'pending_tasks' => array_map(fn($t) => ['id' => (int)$t['task_id'], 'title' => $t['title']], $pendingTasks)
            ], 409);
        }

        $db->beginTransaction();
        try {
            $resolvedCount = 0;

            if (!empty($pendingTasks)) {
                $stmtCountLinks = $db->prepare("SELECT COUNT(*) FROM sprint_tasks WHERE task_id = ?");

                if ($pendingAction === 'detach') {
                    $sprintNumMap = SubtaskStateHelper::getSprintNumberMap($db);
                    $activeSprintNum = (int)$activeSprint['number'];
                    $stmtDetachDirect = $db->prepare("UPDATE tasks SET property_id = NULL WHERE id = ?");
                    $stmtCloneTask = $db->prepare("
                        INSERT INTO tasks (title, description, created_by, property_id, priority, due_date)
                        SELECT title, description, created_by, NULL, priority, due_date
                        FROM tasks WHERE id = ?
                    ");
                    $stmtGetSubtasks = $db->prepare("
                        SELECT * FROM subtasks WHERE task_id = ? ORDER BY parent_id ASC, position ASC, id ASC
                    ");
                    $stmtInsertSubtask = $db->prepare("
                        INSERT INTO subtasks (task_id, parent_id, title, is_done, position, created_sprint_id)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ");
                    $stmtRepointSprintTask = $db->prepare("UPDATE sprint_tasks SET task_id = ? WHERE id = ?");

                    foreach ($pendingTasks as $pt) {
                        $taskId = (int)$pt['task_id'];
                        $stmtCountLinks->execute([$taskId]);
                        $linkCount = (int)$stmtCountLinks->fetchColumn();

                        if ($linkCount <= 1) {
                            $stmtDetachDirect->execute([$taskId]);
                        } else {
                            // Préserver l'historique des sprints clôturés en clonant la tâche pour le sprint actif sans logement
                            $stmtCloneTask->execute([$taskId]);
                            $newTaskId = (int)$db->lastInsertId();

                            $stmtGetSubtasks->execute([$taskId]);
                            $oldSubtasks = array_values(array_filter(
                                $stmtGetSubtasks->fetchAll(),
                                fn($sub) => SubtaskStateHelper::isVisibleInSprint($sub, $activeSprintNum, $sprintNumMap)
                            ));
                            $subMap = [];
                            $remaining = $oldSubtasks;
                            $iter = 0;
                            while (!empty($remaining) && $iter < 10) {
                                $nextRemaining = [];
                                $iter++;
                                foreach ($remaining as $sub) {
                                    $oldParent = !empty($sub['parent_id']) ? (int)$sub['parent_id'] : null;
                                    if ($oldParent === null || isset($subMap[$oldParent])) {
                                        $newParent = $oldParent ? $subMap[$oldParent] : null;
                                        $stmtInsertSubtask->execute([
                                            $newTaskId,
                                            $newParent,
                                            $sub['title'],
                                            $sub['is_done'],
                                            $sub['position'],
                                            (int)$activeSprint['id']
                                        ]);
                                        $subMap[$sub['id']] = (int)$db->lastInsertId();
                                    } else {
                                        $nextRemaining[] = $sub;
                                    }
                                }
                                if (count($nextRemaining) === count($remaining)) {
                                    foreach ($nextRemaining as $orphan) {
                                        $stmtInsertSubtask->execute([
                                            $newTaskId,
                                            null,
                                            $orphan['title'],
                                            $orphan['is_done'],
                                            $orphan['position'],
                                            (int)$activeSprint['id']
                                        ]);
                                        $subMap[$orphan['id']] = (int)$db->lastInsertId();
                                    }
                                    break;
                                }
                                $remaining = $nextRemaining;
                            }

                            $stmtRepointSprintTask->execute([$newTaskId, $pt['sprint_task_id']]);
                        }
                        $resolvedCount++;
                    }
                } else if ($pendingAction === 'delete') {
                    $stmtDeleteSprintTask = $db->prepare("DELETE FROM sprint_tasks WHERE id = ?");
                    $stmtDeleteTask = $db->prepare("DELETE FROM tasks WHERE id = ?");

                    foreach ($pendingTasks as $pt) {
                        $taskId = (int)$pt['task_id'];
                        $stmtDeleteSprintTask->execute([$pt['sprint_task_id']]);
                        $stmtCountLinks->execute([$taskId]);
                        if ((int)$stmtCountLinks->fetchColumn() === 0) {
                            $stmtDeleteTask->execute([$taskId]);
                        }
                        $resolvedCount++;
                    }
                }
            }

            $stmtDeactivate = $db->prepare("UPDATE properties SET is_active = 0, deleted_at = NOW() WHERE id = ?");
            $stmtDeactivate->execute([$id]);

            $db->commit();

            $stmtGet = $db->prepare("SELECT * FROM properties WHERE id = ?");
            $stmtGet->execute([$id]);
            $updatedProp = $stmtGet->fetch();

            Response::json([
                'success' => true,
                'message' => "Hébergement « {$property['name']} » désactivé avec succès.",
                'property' => $updatedProp,
                'resolved_count' => $resolvedCount
            ]);
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('Erreur PropertyController::deactivate : ' . $e->getMessage());
            Response::error("Erreur interne lors de la désactivation de l'hébergement.", 500);
        }
    }

    /**
     * POST /api/properties/{id}/reactivate
     * Réactivation d'un hébergement désactivé (Admin uniquement)
     */
    public function reactivate(int $id): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $stmtProp = $db->prepare("SELECT * FROM properties WHERE id = ? LIMIT 1");
        $stmtProp->execute([$id]);
        $property = $stmtProp->fetch();
        if (!$property) {
            Response::error('Hébergement introuvable.', 404);
        }

        $stmtReact = $db->prepare("UPDATE properties SET is_active = 1, deleted_at = NULL WHERE id = ?");
        $stmtReact->execute([$id]);

        $stmtGet = $db->prepare("SELECT * FROM properties WHERE id = ?");
        $stmtGet->execute([$id]);
        $updatedProp = $stmtGet->fetch();

        Response::json([
            'success' => true,
            'message' => "Hébergement « {$property['name']} » réactivé avec succès.",
            'property' => $updatedProp
        ]);
    }

    /**
     * PATCH /api/properties/reorder
     * Réordonne les hébergements (Admin uniquement)
     */
    public function reorder(): void {
        Auth::requireAdmin();
        $db = Database::getConnection();

        $body = Request::jsonBody();
        $orderedIds = $body['ordered_property_ids'] ?? [];
        if (!is_array($orderedIds) || empty($orderedIds)) {
            Response::error('Liste ordonnée des hébergements requise.', 400);
        }

        $rows = $db->query("SELECT id, position FROM properties ORDER BY is_active DESC, position ASC, name ASC, id ASC")->fetchAll();
        $currentPosMap = [];
        $allIds = [];
        foreach ($rows as $r) {
            $pid = (int)$r['id'];
            $allIds[] = $pid;
            $currentPosMap[$pid] = (int)$r['position'];
        }

        $finalOrder = [];
        foreach ($orderedIds as $rawId) {
            $pid = (int)$rawId;
            if ($pid > 0 && in_array($pid, $allIds, true) && !in_array($pid, $finalOrder, true)) {
                $finalOrder[] = $pid;
            }
        }
        foreach ($allIds as $pid) {
            if (!in_array($pid, $finalOrder, true)) {
                $finalOrder[] = $pid;
            }
        }

        $db->beginTransaction();
        try {
            $stmtUp = $db->prepare("UPDATE properties SET position = ? WHERE id = ?");
            foreach ($finalOrder as $idx => $pid) {
                $newPos = $idx + 1;
                if (($currentPosMap[$pid] ?? -1) !== $newPos) {
                    $stmtUp->execute([$newPos, $pid]);
                }
            }
            $db->commit();

            $properties = $db->query("SELECT * FROM properties ORDER BY is_active DESC, position ASC, name ASC, id ASC")->fetchAll();
            Response::json([
                'success' => true,
                'message' => "Ordre des hébergements mis à jour.",
                'properties' => $properties
            ]);
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('Erreur PropertyController::reorder : ' . $e->getMessage());
            Response::error("Erreur interne lors du réordonnancement des hébergements.", 500);
        }
    }
}
