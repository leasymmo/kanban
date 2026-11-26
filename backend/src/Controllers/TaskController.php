<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use PDO;

class TaskController {
    /**
     * Récupère une tâche avec ses informations contextuelles pour un sprint donné
     * (ou le sprint actif / le plus récent associé à cette tâche).
     */
    private function resolveTaskInSprint(PDO $db, int $taskId, ?int $sprintId = null): ?array {
        if ($sprintId && $sprintId > 0) {
            $stmt = $db->prepare("
                SELECT t.id, t.title, t.description, t.created_by,
                       t.property_id, t.priority, t.due_date, t.parent_task_id,
                       st.id as sprint_task_id, st.sprint_id, st.status, st.assigned_to, st.position,
                       st.is_unplanned, st.is_starred, st.is_new,
                       s.status as sprint_status, s.number as sprint_number
                FROM tasks t
                JOIN sprint_tasks st ON st.task_id = t.id
                JOIN sprints s ON s.id = st.sprint_id
                WHERE t.id = ? AND st.sprint_id = ?
                LIMIT 1
            ");
            $stmt->execute([$taskId, $sprintId]);
        } else {
            $stmt = $db->prepare("
                SELECT t.id, t.title, t.description, t.created_by,
                       t.property_id, t.priority, t.due_date, t.parent_task_id,
                       st.id as sprint_task_id, st.sprint_id, st.status, st.assigned_to, st.position,
                       st.is_unplanned, st.is_starred, st.is_new,
                       s.status as sprint_status, s.number as sprint_number
                FROM tasks t
                JOIN sprint_tasks st ON st.task_id = t.id
                JOIN sprints s ON s.id = st.sprint_id
                WHERE t.id = ?
                ORDER BY (s.status = 'active') DESC, s.number DESC, st.id DESC
                LIMIT 1
            ");
            $stmt->execute([$taskId]);
        }

        $row = $stmt->fetch();
        return $row ?: null;
    }

    /**
     * Vérifie que l'utilisateur courant a le droit d'agir sur cette tâche dans ce sprint.
     */
    private function assertCanModifyTask(array $currentUser, array $task, string $actionLabel = 'modifier'): void {
        if ($currentUser['role'] === 'admin') {
            return;
        }

        if ($task['sprint_status'] === 'closed') {
            Response::error('Sprint clôturé : modification interdite en lecture seule', 403);
        }

        $isAssignedToMe = ($task['assigned_to'] !== null && (int)$task['assigned_to'] === (int)$currentUser['id']);
        $isCreatedByMeUnassigned = ($task['assigned_to'] === null && (int)$task['created_by'] === (int)$currentUser['id']);

        if (!$isAssignedToMe && !$isCreatedByMeUnassigned) {
            Response::error("Vous n'avez pas l'autorisation de {$actionLabel} cette tâche.", 403);
        }
    }

    /**
     * Valide le format d'une date d'échéance (YYYY-MM-DD)
     */
    private function validateDueDate(?string $dueDate): ?string {
        if ($dueDate === null || trim($dueDate) === '') {
            return null;
        }
        $clean = trim($dueDate);
        $dt = \DateTime::createFromFormat('Y-m-d', $clean);
        if (!$dt || $dt->format('Y-m-d') !== $clean) {
            Response::error("Format de date d'échéance invalide (YYYY-MM-DD attendu).", 400);
        }
        return $clean;
    }

    /**
     * Vérifie que l'utilisateur cible existe en base
     */
    private function assertUserExists(PDO $db, ?int $userId): void {
        if ($userId === null) {
            return;
        }
        $stmt = $db->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
        $stmt->execute([$userId]);
        if (!$stmt->fetch()) {
            Response::error('Utilisateur responsable introuvable.', 400);
        }
    }

    /**
     * Vérifie que tous les logements non-null fournis existent en base
     */
    private function assertPropertiesExist(PDO $db, array $propertyIds, bool $requireActive = false): void {
        $ids = array_values(array_unique(array_filter($propertyIds, fn($id) => $id !== null && (int)$id > 0)));
        if (empty($ids)) {
            return;
        }
        $inClause = implode(',', array_fill(0, count($ids), '?'));
        $sql = "SELECT id FROM properties WHERE id IN ($inClause)" . ($requireActive ? " AND is_active = 1" : "");
        $stmt = $db->prepare($sql);
        $stmt->execute(array_map('intval', $ids));
        $found = $stmt->fetchAll(PDO::FETCH_COLUMN);
        if (count($found) !== count($ids)) {
            $msg = $requireActive
                ? 'Un ou plusieurs logements sélectionnés sont introuvables ou désactivés.'
                : 'Un ou plusieurs logements sélectionnés sont introuvables.';
            Response::error($msg, 400);
        }
    }

    /**
     * Insère une liste de sous-tâches (format plat avec temp_id/parent_temp_id OU imbriqué avec children).
     * Limite la profondeur à 4 niveaux (0 à 3).
     */
    private function insertSubtasksForTask(PDO $db, int $taskId, array $subtasksList, ?int $createdSprintId = null): void {
        if (empty($subtasksList)) {
            return;
        }

        $tempIdMap = [];
        $depthMap = [];
        $stmtSub = $db->prepare("
            INSERT INTO subtasks (task_id, parent_id, title, is_done, position, created_sprint_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ");

        $insertRecursive = function(array $items, ?int $forcedParentId = null, int $forcedDepth = 0) use (&$insertRecursive, &$tempIdMap, &$depthMap, $db, $stmtSub, $taskId, $createdSprintId) {
            $fallbackPos = 1;
            foreach ($items as $item) {
                $title = is_string($item) ? trim($item) : trim($item['title'] ?? '');
                if ($title === '') {
                    continue;
                }

                $isDone = is_array($item) && !empty($item['is_done']) ? 1 : 0;
                $pos = (is_array($item) && isset($item['position'])) ? (int)$item['position'] : $fallbackPos++;

                $parentId = $forcedParentId;
                $depth = $forcedDepth;

                if ($parentId === null && is_array($item)) {
                    if (!empty($item['parent_temp_id']) && isset($tempIdMap[$item['parent_temp_id']])) {
                        $parentId = $tempIdMap[$item['parent_temp_id']];
                        $depth = ($depthMap[$parentId] ?? 0) + 1;
                    }
                }

                if ($depth > 3) {
                    continue;
                }

                $stmtSub->execute([$taskId, $parentId, $title, $isDone, $pos, $createdSprintId]);
                $newSubId = (int)$db->lastInsertId();
                $depthMap[$newSubId] = $depth;

                if (is_array($item) && !empty($item['temp_id'])) {
                    $tempIdMap[$item['temp_id']] = $newSubId;
                }

                if ($depth < 3 && is_array($item) && !empty($item['children']) && is_array($item['children'])) {
                    $insertRecursive($item['children'], $newSubId, $depth + 1);
                }
            }
        };

        $insertRecursive($subtasksList);
    }

    /**
     * POST /api/tasks
     * Création d'une ou plusieurs tâches (multi-logements supporté)
     */
    public function create(): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $title = trim($body['title'] ?? '');
        $sprintId = (int)($body['sprint_id'] ?? 0);

        if ($title === '' || $sprintId <= 0) {
            Response::error('Titre et sprint requis', 400);
        }

        // Vérification du sprint
        $stmtSprint = $db->prepare("SELECT status FROM sprints WHERE id = ?");
        $stmtSprint->execute([$sprintId]);
        $sprint = $stmtSprint->fetch();
        if (!$sprint) {
            Response::error('Sprint introuvable', 404);
        }

        if ($sprint['status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Impossible de créer une tâche dans un sprint clôturé (lecture seule)', 403);
        }

        // Règle d'attribution :
        // - Administrateur : peut attribuer à n'importe quel associé ou laisser non attribuée
        // - Écriture : ne peut attribuer qu'à lui-même ou laisser non attribuée (jamais à un autre utilisateur)
        if ($currentUser['role'] === 'admin') {
            $assignedTo = !empty($body['assigned_to']) ? (int)$body['assigned_to'] : null;
        } else {
            if (array_key_exists('assigned_to', $body)) {
                $requestedAssignee = !empty($body['assigned_to']) ? (int)$body['assigned_to'] : null;
                if ($requestedAssignee !== null && $requestedAssignee !== (int)$currentUser['id']) {
                    Response::error("Seul un administrateur peut créer une tâche pour un autre utilisateur.", 403);
                }
                $assignedTo = $requestedAssignee;
            } else {
                $assignedTo = (int)$currentUser['id'];
            }
        }

        // Support multi-logements via property_ids (ou rétrocompatible property_id)
        $targetPropertyIds = [];
        if (isset($body['property_ids']) && is_array($body['property_ids'])) {
            foreach ($body['property_ids'] as $pid) {
                $val = ($pid !== null && $pid !== '' && (int)$pid > 0) ? (int)$pid : null;
                if (!in_array($val, $targetPropertyIds, true)) {
                    $targetPropertyIds[] = $val;
                }
            }
            if (empty($targetPropertyIds)) {
                $targetPropertyIds = [null];
            }
        } else {
            $targetPropertyIds = [!empty($body['property_id']) ? (int)$body['property_id'] : null];
        }

        $isMeetingPending = !empty($body['pending_for_next_sprint'])
            || (($body['created_from'] ?? '') === 'meeting_pending')
            || (($body['status'] ?? '') === 'pending');

        if ($isMeetingPending) {
            $status = 'pending';
        } else {
            if ($assignedTo === null) {
                Response::error("Une tâche active doit obligatoirement être attribuée à un associé. Utilisez « Nouvelle tâche en séance » pour créer une tâche non attribuée.", 400);
            }
            $status = in_array($body['status'] ?? '', ['todo', 'in_progress', 'blocked', 'done']) ? $body['status'] : 'todo';
        }
        $priority = in_array($body['priority'] ?? '', ['low', 'medium', 'high']) ? $body['priority'] : 'medium';
        $description = trim($body['description'] ?? '');
        $dueDate = $this->validateDueDate($body['due_date'] ?? null);

        $this->assertUserExists($db, $assignedTo);
        $this->assertPropertiesExist($db, $targetPropertyIds, $sprint['status'] === 'active');

        // Déduction automatique de "réalisation complémentaire" selon l'onglet d'origine
        if (isset($body['created_from'])) {
            $isUnplanned = ($body['created_from'] === 'tasks') ? 1 : 0;
        } else {
            $isUnplanned = !empty($body['is_unplanned']) ? 1 : 0;
        }
        $isStarred = ($status === 'pending') ? 0 : (!empty($body['is_starred']) ? 1 : 0);
        $subtasksList = (!empty($body['subtasks']) && is_array($body['subtasks'])) ? $body['subtasks'] : [];

        $db->beginTransaction();
        try {
            $stmtPos = $db->prepare("SELECT COALESCE(MAX(position), 0) as max_pos FROM sprint_tasks WHERE sprint_id = ?");
            $stmtPos->execute([$sprintId]);
            $position = (int)($stmtPos->fetch()['max_pos'] ?? 0);

            $stmtTask = $db->prepare("
                INSERT INTO tasks (
                    title, description, created_by,
                    property_id, priority, due_date
                ) VALUES (?, ?, ?, ?, ?, ?)
            ");

            $stmtSprintTask = $db->prepare("
                INSERT INTO sprint_tasks (
                    sprint_id, task_id, status, assigned_to, position, is_unplanned, is_starred, is_new
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)
            ");

            $createdIds = [];
            foreach ($targetPropertyIds as $propId) {
                $position++;
                $stmtTask->execute([
                    $title,
                    $description,
                    $currentUser['id'],
                    $propId,
                    $priority,
                    $dueDate
                ]);
                $taskId = (int)$db->lastInsertId();

                $stmtSprintTask->execute([
                    $sprintId,
                    $taskId,
                    $status,
                    $assignedTo,
                    $position,
                    $isUnplanned,
                    $isStarred
                ]);

                if (!empty($subtasksList)) {
                    $this->insertSubtasksForTask($db, $taskId, $subtasksList, $sprintId);
                }

                $createdIds[] = $taskId;
            }

            $db->commit();

            $count = count($createdIds);
            Response::json([
                'success' => true,
                'task_id' => $createdIds[0],
                'task_ids' => $createdIds,
                'created_count' => $count,
                'status' => $status,
                'message' => $isMeetingPending
                    ? ($count > 1 ? "{$count} tâches ajoutées en attente (pending) pour le prochain sprint" : 'Tâche ajoutée en attente (pending) pour le prochain sprint')
                    : ($count > 1 ? "{$count} tâches créées avec succès" : 'Tâche créée avec succès')
            ]);
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('Erreur TaskController::create : ' . $e->getMessage());
            Response::error('Erreur interne lors de la création de la tâche.', 500);
        }
    }

    /**
     * PUT/PATCH /api/tasks/{id}
     * Modification d'une tâche
     */
    public function update(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $sprintId = !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null;

        $task = $this->resolveTaskInSprint($db, $id, $sprintId);
        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, 'modifier');

        $title = isset($body['title']) ? trim($body['title']) : $task['title'];
        $description = isset($body['description']) ? trim($body['description']) : $task['description'];
        $priority = in_array($body['priority'] ?? '', ['low', 'medium', 'high']) ? $body['priority'] : $task['priority'];
        $propertyId = array_key_exists('property_id', $body)
            ? (!empty($body['property_id']) ? (int)$body['property_id'] : null)
            : $task['property_id'];
        $dueDate = array_key_exists('due_date', $body)
            ? $this->validateDueDate($body['due_date'])
            : $task['due_date'];
        $isStarred = array_key_exists('is_starred', $body)
            ? (!empty($body['is_starred']) ? 1 : 0)
            : (int)($task['is_starred'] ?? 0);

        // Règle d'attribution :
        // - Administrateur : peut modifier librement assigned_to
        // - Écriture : ne peut basculer qu'entre lui-même et non attribuée (jamais attribuer à un autre associé)
        $assignedTo = $task['assigned_to'] !== null ? (int)$task['assigned_to'] : null;
        if (array_key_exists('assigned_to', $body)) {
            $requestedAssignee = !empty($body['assigned_to']) ? (int)$body['assigned_to'] : null;
            if ($currentUser['role'] === 'admin') {
                $assignedTo = $requestedAssignee;
            } else if ($requestedAssignee !== null && $requestedAssignee !== (int)$currentUser['id']) {
                Response::error("Seul un administrateur peut attribuer une tâche à un autre utilisateur.", 403);
            } else {
                $assignedTo = $requestedAssignee;
            }
        }

        // Règle de statut et d'attribution :
        // - Une tâche en attente ('pending') reste toujours au statut 'pending' (attribuée ou non) jusqu'à la clôture du sprint.
        // - Une tâche active (non 'pending') doit obligatoirement avoir un responsable (assigned_to NOT NULL).
        if ($task['status'] === 'pending' || (($body['status'] ?? '') === 'pending')) {
            $status = 'pending';
            $isStarred = 0;
        } else {
            if ($assignedTo === null && $task['sprint_status'] === 'active') {
                Response::error("Une tâche active doit obligatoirement être attribuée à un associé.", 400);
            }
            $requestedStatus = $body['status'] ?? '';
            $status = in_array($requestedStatus, ['todo', 'in_progress', 'blocked', 'done'], true)
                ? $requestedStatus
                : $task['status'];
        }

        $this->assertUserExists($db, $assignedTo !== null ? (int)$assignedTo : null);
        if ($propertyId !== null) {
            $mustBeActive = ($task['sprint_status'] === 'active' && (int)$propertyId !== (int)($task['property_id'] ?? 0));
            $this->assertPropertiesExist($db, [(int)$propertyId], $mustBeActive);
        }

        $db->beginTransaction();
        try {
            $stmtUpdate = $db->prepare("
                UPDATE tasks
                SET title = ?, description = ?,
                    property_id = ?, priority = ?, due_date = ?
                WHERE id = ?
            ");
            $stmtUpdate->execute([
                $title, $description,
                $propertyId, $priority, $dueDate, $id
            ]);

            $stmtUpdateSprintTask = $db->prepare("
                UPDATE sprint_tasks
                SET status = ?, assigned_to = ?, is_starred = ?
                WHERE id = ?
            ");
            $stmtUpdateSprintTask->execute([
                $status, $assignedTo, $isStarred, $task['sprint_task_id']
            ]);

            // Synchronisation des sous-tâches si transmises dans la mise à jour
            if (array_key_exists('subtasks', $body) && is_array($body['subtasks'])) {
                $effectiveSprintId = (int)$task['sprint_id'];
                $effectiveSprintNumber = (int)$task['sprint_number'];
                $isClosedSprint = ($task['sprint_status'] === 'closed');
                $subtaskCreatedSprintId = $effectiveSprintId;
                $sprintNumMap = \App\SubtaskStateHelper::getSprintNumberMap($db);

                $stmtExisting = $db->prepare("SELECT id, created_sprint_id, deleted_sprint_id FROM subtasks WHERE task_id = ?");
                $stmtExisting->execute([$id]);
                $existingIds = [];
                foreach ($stmtExisting->fetchAll(PDO::FETCH_ASSOC) as $exSub) {
                    if (\App\SubtaskStateHelper::isVisibleInSprint($exSub, $effectiveSprintNumber, $sprintNumMap)) {
                        $existingIds[] = (int)$exSub['id'];
                    }
                }

                $keptIds = [];
                $tempIdMap = [];
                $depthMap = [];

                foreach ($body['subtasks'] as $idx => $st) {
                    if (is_string($st)) {
                        $st = ['title' => $st, 'is_done' => 0, 'position' => $idx + 1];
                    }
                    $stTitle = trim($st['title'] ?? '');
                    if ($stTitle === '') continue;

                    $stDone = !empty($st['is_done']) ? 1 : 0;
                    $stPos = isset($st['position']) ? (int)$st['position'] : ($idx + 1);
                    $stId = !empty($st['id']) ? (int)$st['id'] : null;
                    $stParent = !empty($st['parent_id']) ? (int)$st['parent_id'] : null;

                    if (!$stParent && !empty($st['parent_temp_id']) && isset($tempIdMap[$st['parent_temp_id']])) {
                        $stParent = $tempIdMap[$st['parent_temp_id']];
                    }

                    // Empêcher l'auto-référence ou le rattachement à une sous-tâche d'une autre tâche
                    if ($stParent !== null) {
                        if ($stId !== null && $stParent === $stId) {
                            $stParent = null;
                        } else if (!in_array($stParent, $existingIds, true) && !in_array($stParent, $keptIds, true)) {
                            $stParent = null;
                        }
                    }

                    $depth = $stParent !== null ? (($depthMap[$stParent] ?? 0) + 1) : 0;
                    if ($depth > 3) {
                        continue;
                    }

                    if ($stId && in_array($stId, $existingIds, true)) {
                        if ($isClosedSprint) {
                            // Ne pas altérer subtasks.is_done du sprint actif lors d'une retouche d'archive
                            $stmtUp = $db->prepare("UPDATE subtasks SET title = ?, parent_id = ?, position = ? WHERE id = ? AND task_id = ?");
                            $stmtUp->execute([$stTitle, $stParent, $stPos, $stId, $id]);
                            \App\SubtaskStateHelper::setClosedSprintSubtaskDelta($db, $stId, $effectiveSprintId, $effectiveSprintNumber, $stDone);
                        } else {
                            $stmtUp = $db->prepare("UPDATE subtasks SET title = ?, is_done = ?, parent_id = ?, position = ? WHERE id = ? AND task_id = ?");
                            $stmtUp->execute([$stTitle, $stDone, $stParent, $stPos, $stId, $id]);
                        }
                        $keptIds[] = $stId;
                        $depthMap[$stId] = $depth;
                        if (!empty($st['temp_id'])) {
                            $tempIdMap[$st['temp_id']] = $stId;
                        }
                    } else {
                        $liveDone = $isClosedSprint ? 0 : $stDone;
                        $stmtIns = $db->prepare("INSERT INTO subtasks (task_id, parent_id, title, is_done, position, created_sprint_id) VALUES (?, ?, ?, ?, ?, ?)");
                        $stmtIns->execute([$id, $stParent, $stTitle, $liveDone, $stPos, $subtaskCreatedSprintId]);
                        $newId = (int)$db->lastInsertId();
                        if ($isClosedSprint && $stDone === 1) {
                            \App\SubtaskStateHelper::setClosedSprintSubtaskDelta($db, $newId, $effectiveSprintId, $effectiveSprintNumber, 1);
                        }
                        $keptIds[] = $newId;
                        $depthMap[$newId] = $depth;
                        if (!empty($st['temp_id'])) {
                            $tempIdMap[$st['temp_id']] = $newId;
                        }
                    }
                }

                $toDelete = array_diff($existingIds, $keptIds);
                foreach ($toDelete as $delId) {
                    \App\SubtaskStateHelper::deleteSubtreeInSprint($db, $id, (int)$delId, $effectiveSprintId);
                }
            }

            $db->commit();
            Response::success(null, 'Tâche mise à jour');
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('Erreur TaskController::update : ' . $e->getMessage());
            Response::error('Erreur interne lors de la mise à jour de la tâche.', 500);
        }
    }

    /**
     * PATCH /api/tasks/reorder
     * Réordonne les tâches dans un sprint (et met à jour le statut ou le logement si déplacée par glisser-déposer)
     */
    public function reorder(): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $sprintId = !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null;
        $taskId = !empty($body['task_id']) ? (int)$body['task_id'] : 0;

        if ($taskId <= 0) {
            Response::error('Identifiant de tâche requis', 400);
        }

        $task = $this->resolveTaskInSprint($db, $taskId, $sprintId);
        if (!$task) {
            Response::error('Tâche introuvable dans ce sprint', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, 'déplacer');

        $effectiveSprintId = (int)$task['sprint_id'];

        $db->beginTransaction();
        try {
            // Changement de statut éventuel
            if (isset($body['status'])) {
                if ($task['status'] === 'pending') {
                    Response::error("Une tâche en attente (pending) ne peut pas changer de statut avant la clôture du sprint.", 400);
                }
                if (!in_array($body['status'], ['todo', 'in_progress', 'blocked', 'done'])) {
                    Response::error('Statut invalide', 400);
                }
                $stmtStatus = $db->prepare("UPDATE sprint_tasks SET status = ? WHERE id = ?");
                $stmtStatus->execute([$body['status'], $task['sprint_task_id']]);
            }

            // Changement de logement éventuel (Vue par Logement)
            if (array_key_exists('property_id', $body)) {
                $newPropertyId = ($body['property_id'] !== null && $body['property_id'] !== '' && (int)$body['property_id'] > 0)
                    ? (int)$body['property_id']
                    : null;
                if ($newPropertyId !== null) {
                    $mustBeActive = ($task['sprint_status'] === 'active' && (int)$newPropertyId !== (int)($task['property_id'] ?? 0));
                    $this->assertPropertiesExist($db, [$newPropertyId], $mustBeActive);
                }
                $stmtProp = $db->prepare("UPDATE tasks SET property_id = ? WHERE id = ?");
                $stmtProp->execute([$newPropertyId, $taskId]);
            }

            // Mise à jour de l'ordre des tâches en conservant les positions des tâches non affichées (filtres)
            if (!empty($body['ordered_task_ids']) && is_array($body['ordered_task_ids'])) {
                $stmtAll = $db->prepare("
                    SELECT task_id
                    FROM sprint_tasks
                    WHERE sprint_id = ?
                    ORDER BY position ASC, task_id ASC
                ");
                $stmtAll->execute([$effectiveSprintId]);
                $allSprintTaskIds = array_map('intval', $stmtAll->fetchAll(PDO::FETCH_COLUMN));

                $orderedSubset = [];
                foreach ($body['ordered_task_ids'] as $rawId) {
                    $tid = (int)$rawId;
                    if ($tid > 0 && in_array($tid, $allSprintTaskIds, true) && !in_array($tid, $orderedSubset, true)) {
                        $orderedSubset[] = $tid;
                    }
                }

                if (!empty($orderedSubset)) {
                    $subsetSet = array_flip($orderedSubset);
                    $slots = [];
                    foreach ($allSprintTaskIds as $idx => $tid) {
                        if (isset($subsetSet[$tid])) {
                            $slots[] = $idx;
                        }
                    }

                    foreach ($slots as $slotPos => $arrayIdx) {
                        if (isset($orderedSubset[$slotPos])) {
                            $allSprintTaskIds[$arrayIdx] = $orderedSubset[$slotPos];
                        }
                    }

                    $stmtUpPos = $db->prepare("UPDATE sprint_tasks SET position = ? WHERE sprint_id = ? AND task_id = ?");
                    foreach ($allSprintTaskIds as $posIdx => $tid) {
                        $stmtUpPos->execute([$posIdx + 1, $effectiveSprintId, $tid]);
                    }
                }
            }

            $db->commit();
            Response::success(null, 'Ordre mis à jour');
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('Erreur TaskController::reorder : ' . $e->getMessage());
            Response::error('Erreur interne lors du réordonnancement.', 500);
        }
    }

    /**
     * PATCH /api/tasks/{id}/status
     * Changement rapide de statut (glisser-déposer ou clic)
     */
    public function updateStatus(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $sprintId = !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null;

        $task = $this->resolveTaskInSprint($db, $id, $sprintId);
        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, 'changer le statut de');

        if ($task['status'] === 'pending') {
            Response::error("Une tâche en attente (pending) ne peut pas changer de statut avant la clôture du sprint.", 400);
        }

        $newStatus = $body['status'] ?? '';
        if (!in_array($newStatus, ['todo', 'in_progress', 'blocked', 'done'])) {
            Response::error('Statut invalide', 400);
        }

        $stmtUpdate = $db->prepare("UPDATE sprint_tasks SET status = ? WHERE id = ?");
        $stmtUpdate->execute([$newStatus, $task['sprint_task_id']]);

        Response::success(['status' => $newStatus], 'Statut mis à jour');
    }

    /**
     * PATCH /api/tasks/{id}/star
     * Active / désactive l'étoile de mise en avant (spécifique au sprint courant)
     */
    public function toggleStar(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $sprintId = !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null;

        $task = $this->resolveTaskInSprint($db, $id, $sprintId);
        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, 'mettre en avant');

        if ($task['status'] === 'pending') {
            Response::error("Une tâche en attente (pending) ne peut pas être mise en avant.", 400);
        }

        $newStarred = empty($task['is_starred']) ? 1 : 0;
        $stmtUpdate = $db->prepare("UPDATE sprint_tasks SET is_starred = ? WHERE id = ?");
        $stmtUpdate->execute([$newStarred, $task['sprint_task_id']]);

        Response::json([
            'success' => true,
            'task_id' => $id,
            'is_starred' => (bool)$newStarred,
            'message' => $newStarred ? 'Tâche mise en avant' : 'Mise en avant retirée'
        ]);
    }

    /**
     * DELETE /api/tasks/{id}
     */
    public function delete(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $sprintId = !empty($_GET['sprint_id']) ? (int)$_GET['sprint_id'] : (!empty($body['sprint_id']) ? (int)$body['sprint_id'] : null);

        $task = $this->resolveTaskInSprint($db, $id, $sprintId);
        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, 'supprimer');

        $db->beginTransaction();
        try {
            $stmtDelLink = $db->prepare("DELETE FROM sprint_tasks WHERE id = ?");
            $stmtDelLink->execute([$task['sprint_task_id']]);

            // Si la tâche n'appartient plus à aucun sprint, on la supprime complètement
            $stmtRemaining = $db->prepare("SELECT COUNT(*) FROM sprint_tasks WHERE task_id = ?");
            $stmtRemaining->execute([$id]);
            if ((int)$stmtRemaining->fetchColumn() === 0) {
                $stmtDel = $db->prepare("DELETE FROM tasks WHERE id = ?");
                $stmtDel->execute([$id]);
            }

            $db->commit();
            Response::success(null, 'Tâche supprimée');
        } catch (\Throwable $e) {
            $db->rollBack();
            error_log('Erreur TaskController::delete : ' . $e->getMessage());
            Response::error('Erreur interne lors de la suppression de la tâche.', 500);
        }
    }

    /**
     * POST /api/tasks/{id}/subtasks
     * Ajout d'une sous-tâche
     */
    public function addSubtask(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $sprintId = !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null;

        $task = $this->resolveTaskInSprint($db, $id, $sprintId);
        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, "ajouter des sous-tâches à");

        $title = trim($body['title'] ?? '');
        if ($title === '') {
            Response::error('Titre de la sous-tâche requis', 400);
        }

        $parentId = !empty($body['parent_id']) ? (int)$body['parent_id'] : null;
        if ($parentId) {
            $stmtP = $db->prepare("SELECT id, parent_id FROM subtasks WHERE id = ? AND task_id = ?");
            $stmtP->execute([$parentId, $id]);
            $parentRow = $stmtP->fetch();
            if (!$parentRow) {
                Response::error('Sous-tâche parente introuvable pour cette tâche', 400);
            }

            // Vérifier que la profondeur maximale (4 niveaux : 0..3) n'est pas dépassée
            $depth = 0;
            $cursor = $parentRow['parent_id'] ? (int)$parentRow['parent_id'] : null;
            $stmtAnc = $db->prepare("SELECT parent_id FROM subtasks WHERE id = ? AND task_id = ?");
            while ($cursor !== null && $depth < 4) {
                $depth++;
                $stmtAnc->execute([$cursor, $id]);
                $anc = $stmtAnc->fetch();
                $cursor = ($anc && $anc['parent_id']) ? (int)$anc['parent_id'] : null;
            }
            if ($depth >= 3) {
                Response::error('Profondeur maximale de 4 niveaux atteinte pour les sous-tâches.', 400);
            }
        }

        $stmtPos = $db->prepare("SELECT MAX(position) as max_pos FROM subtasks WHERE task_id = ? AND deleted_sprint_id IS NULL AND " . ($parentId ? "parent_id = ?" : "parent_id IS NULL"));
        if ($parentId) {
            $stmtPos->execute([$id, $parentId]);
        } else {
            $stmtPos->execute([$id]);
        }
        $maxPos = (int)($stmtPos->fetch()['max_pos'] ?? 0);

        $subCreatedSprintId = (int)$task['sprint_id'];
        $stmtInsert = $db->prepare("INSERT INTO subtasks (task_id, parent_id, title, is_done, position, created_sprint_id) VALUES (?, ?, ?, 0, ?, ?)");
        $stmtInsert->execute([$id, $parentId, $title, $maxPos + 1, $subCreatedSprintId]);
        $newSubtaskId = (int)$db->lastInsertId();

        Response::json([
            'success' => true,
            'subtask_id' => $newSubtaskId,
            'subtask' => [
                'id' => $newSubtaskId,
                'task_id' => $id,
                'parent_id' => $parentId,
                'title' => $title,
                'is_done' => 0,
                'position' => $maxPos + 1,
                'created_sprint_id' => $subCreatedSprintId,
                'children' => []
            ],
            'message' => 'Sous-tâche ajoutée'
        ]);
    }

    /**
     * PATCH /api/subtasks/{id}/toggle
     * Coche / décoche une sous-tâche
     */
    public function toggleSubtask(int $subtaskId): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $sprintId = !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null;

        $stmt = $db->prepare("SELECT * FROM subtasks WHERE id = ?");
        $stmt->execute([$subtaskId]);
        $subtask = $stmt->fetch();

        if (!$subtask) {
            Response::error('Sous-tâche introuvable', 404);
        }

        $task = $this->resolveTaskInSprint($db, (int)$subtask['task_id'], $sprintId);
        if (!$task) {
            Response::error('Tâche associée introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, 'cocher les sous-tâches de');

        if ($task['sprint_status'] === 'closed') {
            // Action admin sur un sprint archivé : basculer uniquement le delta de ce sprint
            $resolvedMap = \App\SubtaskStateHelper::fetchResolvedStatesBySubtaskIds(
                $db,
                [$subtaskId],
                (int)$task['sprint_number'],
                false
            );
            $currentDone = $resolvedMap[$subtaskId] ?? 0;
            $newDone = $currentDone ? 0 : 1;
            \App\SubtaskStateHelper::setClosedSprintSubtaskDelta(
                $db,
                $subtaskId,
                (int)$task['sprint_id'],
                (int)$task['sprint_number'],
                $newDone
            );
        } else {
            // Sprint actif : écriture directe sur subtasks.is_done, aucun delta écrit avant clôture
            $newDone = $subtask['is_done'] ? 0 : 1;
            $stmtUpdate = $db->prepare("UPDATE subtasks SET is_done = ? WHERE id = ?");
            $stmtUpdate->execute([$newDone, $subtaskId]);
        }

        Response::json([
            'success' => true,
            'is_done' => $newDone
        ]);
    }

    /**
     * DELETE /api/subtasks/{id}
     */
    public function deleteSubtask(int $subtaskId): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $sprintId = !empty($_GET['sprint_id'])
            ? (int)$_GET['sprint_id']
            : (!empty($body['sprint_id']) ? (int)$body['sprint_id'] : null);

        $stmt = $db->prepare("SELECT * FROM subtasks WHERE id = ?");
        $stmt->execute([$subtaskId]);
        $subtask = $stmt->fetch();

        if (!$subtask) {
            Response::error('Sous-tâche introuvable', 404);
        }

        $task = $this->resolveTaskInSprint($db, (int)$subtask['task_id'], $sprintId);
        if (!$task) {
            Response::error('Tâche associée introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, 'supprimer les sous-tâches de');

        \App\SubtaskStateHelper::deleteSubtreeInSprint(
            $db,
            (int)$subtask['task_id'],
            $subtaskId,
            (int)$task['sprint_id']
        );

        Response::success(null, 'Sous-tâche supprimée');
    }
}
