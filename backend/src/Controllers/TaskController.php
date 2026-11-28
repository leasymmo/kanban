<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use App\Request;
use App\SubtaskStateHelper;
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
                       t.property_id, t.priority, t.due_date,
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
                       t.property_id, t.priority, t.due_date,
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
     * Vérifie que tous les logements non-null fournis sont valides et existent en base
     */
    private function assertPropertiesExist(PDO $db, array $propertyIds, bool $requireActive = false): void {
        $ids = [];
        foreach ($propertyIds as $rawId) {
            if ($rawId === null || $rawId === '') continue;
            $intId = (int)$rawId;
            if ($intId <= 0) {
                Response::error('Identifiant de logement invalide.', 400);
            }
            if (!in_array($intId, $ids, true)) {
                $ids[] = $intId;
            }
        }
        if (empty($ids)) {
            return;
        }
        $inClause = implode(',', array_fill(0, count($ids), '?'));
        $sql = "SELECT id FROM properties WHERE id IN ($inClause)" . ($requireActive ? " AND is_active = 1" : "");
        $stmt = $db->prepare($sql);
        $stmt->execute($ids);
        $found = $stmt->fetchAll(PDO::FETCH_COLUMN);
        if (count($found) !== count($ids)) {
            $msg = $requireActive
                ? 'Un ou plusieurs logements sélectionnés sont introuvables ou désactivés.'
                : 'Un ou plusieurs logements sélectionnés sont introuvables.';
            Response::error($msg, 400);
        }
    }

    /**
     * Aplatit une liste de sous-tâches potentiellement imbriquées (`children`) en liste ordonnée avec temp_id / parent_temp_id.
     */
    private function flattenIncomingSubtasks(array $subtasksList): array {
        $flat = [];
        $autoSeq = 0;

        $walk = function(array $items, ?int $parentId = null, ?string $parentTempId = null) use (&$walk, &$flat, &$autoSeq) {
            foreach ($items as $idx => $raw) {
                if (is_string($raw)) {
                    $title = trim($raw);
                    if ($title === '') continue;
                    $autoSeq++;
                    $flat[] = [
                        'id' => null,
                        'temp_id' => 'auto_' . $autoSeq,
                        'parent_id' => $parentId,
                        'parent_temp_id' => $parentTempId,
                        'title' => mb_substr($title, 0, 255),
                        'is_done' => 0,
                        'position' => $idx + 1,
                    ];
                    continue;
                }
                if (!is_array($raw)) continue;

                $title = trim((string)($raw['title'] ?? ''));
                if ($title === '') continue;

                $autoSeq++;
                $stId = !empty($raw['id']) ? (int)$raw['id'] : null;
                $tempId = !empty($raw['temp_id']) ? (string)$raw['temp_id'] : ('auto_' . $autoSeq);
                $stParentId = $parentId ?? (!empty($raw['parent_id']) ? (int)$raw['parent_id'] : null);
                $stParentTempId = $parentTempId ?? (!empty($raw['parent_temp_id']) ? (string)$raw['parent_temp_id'] : null);

                $flat[] = [
                    'id' => $stId,
                    'temp_id' => $tempId,
                    'parent_id' => $stParentId,
                    'parent_temp_id' => $stParentTempId,
                    'title' => mb_substr($title, 0, 255),
                    'is_done' => !empty($raw['is_done']) ? 1 : 0,
                    'position' => isset($raw['position']) ? (int)$raw['position'] : ($idx + 1),
                ];

                if (!empty($raw['children']) && is_array($raw['children'])) {
                    $walk($raw['children'], $stId, $stId === null ? $tempId : null);
                }
            }
        };

        $walk($subtasksList);
        return $flat;
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

        $body = Request::jsonBody();
        $title = Request::string($body, 'title');
        $sprintId = (int)($body['sprint_id'] ?? 0);

        if ($title === '' || $sprintId <= 0) {
            Response::error('Titre et sprint requis', 400);
        }
        if (mb_strlen($title) > 255) {
            Response::error('Le titre de la tâche ne doit pas dépasser 255 caractères.', 400);
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
                if ($pid === null || $pid === '') {
                    $val = null;
                } else {
                    $intPid = (int)$pid;
                    if ($intPid <= 0) {
                        Response::error('Identifiant de logement invalide.', 400);
                    }
                    $val = $intPid;
                }
                if (!in_array($val, $targetPropertyIds, true)) {
                    $targetPropertyIds[] = $val;
                }
            }
            if (empty($targetPropertyIds)) {
                $targetPropertyIds = [null];
            }
        } else {
            $rawPid = $body['property_id'] ?? null;
            if ($rawPid !== null && $rawPid !== '' && (int)$rawPid <= 0) {
                Response::error('Identifiant de logement invalide.', 400);
            }
            $targetPropertyIds = [($rawPid !== null && $rawPid !== '') ? (int)$rawPid : null];
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
            $stmtPos = $db->prepare("SELECT COALESCE(MAX(position), 0) as max_pos FROM sprint_tasks WHERE sprint_id = ? FOR UPDATE");
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
            ], 201);
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

        $body = Request::jsonBody();
        $sprintId = !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null;

        $task = $this->resolveTaskInSprint($db, $id, $sprintId);
        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, 'modifier');

        $title = array_key_exists('title', $body) ? Request::string($body, 'title') : $task['title'];
        if ($title === '' || mb_strlen($title) > 255) {
            Response::error('Le titre de la tâche est requis (255 caractères max).', 400);
        }

        $description = array_key_exists('description', $body) ? Request::string($body, 'description') : $task['description'];
        $priority = in_array($body['priority'] ?? '', ['low', 'medium', 'high'], true) ? $body['priority'] : $task['priority'];

        if (array_key_exists('property_id', $body)) {
            $rawPid = $body['property_id'];
            if ($rawPid !== null && $rawPid !== '' && (int)$rawPid <= 0) {
                Response::error('Identifiant de logement invalide.', 400);
            }
            $propertyId = ($rawPid !== null && $rawPid !== '') ? (int)$rawPid : null;
        } else {
            $propertyId = $task['property_id'];
        }

        $dueDate = array_key_exists('due_date', $body)
            ? $this->validateDueDate($body['due_date'] !== null ? Request::string($body, 'due_date') : null)
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
        // - Une tâche en attente ('pending') reste toujours au statut 'pending' jusqu'à la clôture du sprint.
        // - Une tâche active ne peut pas repasser au statut 'pending' via update().
        if ($task['status'] === 'pending') {
            $status = 'pending';
            $isStarred = 0;
        } else {
            if (($body['status'] ?? '') === 'pending') {
                Response::error("Une tâche active ne peut pas être repassée en attente (pending).", 400);
            }
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

            // Synchronisation des sous-tâches si transmises dans la mise à jour (plat ou imbriqué children)
            if (array_key_exists('subtasks', $body) && is_array($body['subtasks'])) {
                $effectiveSprintId = (int)$task['sprint_id'];
                $effectiveSprintNumber = (int)$task['sprint_number'];
                $isClosedSprint = ($task['sprint_status'] === 'closed');
                $subtaskCreatedSprintId = $effectiveSprintId;
                $sprintNumMap = SubtaskStateHelper::getSprintNumberMap($db);

                $stmtExisting = $db->prepare("SELECT id, created_sprint_id, deleted_sprint_id FROM subtasks WHERE task_id = ?");
                $stmtExisting->execute([$id]);
                $existingIds = [];
                foreach ($stmtExisting->fetchAll(PDO::FETCH_ASSOC) as $exSub) {
                    if (SubtaskStateHelper::isVisibleInSprint($exSub, $effectiveSprintNumber, $sprintNumMap)) {
                        $existingIds[] = (int)$exSub['id'];
                    }
                }

                $flatIncoming = $this->flattenIncomingSubtasks($body['subtasks']);
                $keptIds = [];
                $tempIdMap = [];
                $depthMap = [];
                $resolvedParentMap = []; // childId => parentId pour détecter les cycles

                $wouldCreateCycle = function(?int $childId, ?int $parentId) use (&$resolvedParentMap): bool {
                    if ($childId === null || $parentId === null) return false;
                    $cursor = $parentId;
                    $guard = 0;
                    while ($cursor !== null && $guard < 16) {
                        if ($cursor === $childId) return true;
                        $cursor = $resolvedParentMap[$cursor] ?? null;
                        $guard++;
                    }
                    return false;
                };

                // Passe topologique : traite d'abord les racines et les nœuds dont le parent est déjà résolu
                $pending = $flatIncoming;
                $stmtUpClosed = $db->prepare("UPDATE subtasks SET title = ?, parent_id = ?, position = ? WHERE id = ? AND task_id = ?");
                $stmtUpActive = $db->prepare("UPDATE subtasks SET title = ?, is_done = ?, parent_id = ?, position = ? WHERE id = ? AND task_id = ?");
                $stmtIns = $db->prepare("INSERT INTO subtasks (task_id, parent_id, title, is_done, position, created_sprint_id) VALUES (?, ?, ?, ?, ?, ?)");

                while (!empty($pending)) {
                    $nextPending = [];
                    $progressed = false;

                    foreach ($pending as $st) {
                        $stId = $st['id'];
                        $stParent = $st['parent_id'];
                        $stParentTemp = $st['parent_temp_id'];

                        // Attendre que le parent temporaire ou existant soit déjà traité dans cette passe si présent dans le lot
                        if ($stParent === null && $stParentTemp !== null) {
                            if (isset($tempIdMap[$stParentTemp])) {
                                $stParent = $tempIdMap[$stParentTemp];
                            } else {
                                $parentStillPending = false;
                                foreach ($pending as $cand) {
                                    if ($cand['temp_id'] === $stParentTemp && $cand !== $st) {
                                        $parentStillPending = true;
                                        break;
                                    }
                                }
                                if ($parentStillPending) {
                                    $nextPending[] = $st;
                                    continue;
                                }
                            }
                        } elseif ($stParent !== null && !isset($depthMap[$stParent])) {
                            $parentStillPending = false;
                            foreach ($pending as $cand) {
                                if ($cand['id'] === $stParent && $cand !== $st) {
                                    $parentStillPending = true;
                                    break;
                                }
                            }
                            if ($parentStillPending) {
                                $nextPending[] = $st;
                                continue;
                            }
                        }

                        if ($stParent !== null) {
                            if (($stId !== null && $stParent === $stId)
                                || (!in_array($stParent, $existingIds, true) && !in_array($stParent, $keptIds, true))
                                || $wouldCreateCycle($stId, $stParent)
                            ) {
                                $stParent = null;
                            }
                        }

                        $depth = $stParent !== null ? (($depthMap[$stParent] ?? 0) + 1) : 0;
                        if ($depth > 3) {
                            $progressed = true;
                            continue;
                        }

                        $progressed = true;
                        if ($stId && in_array($stId, $existingIds, true)) {
                            if ($isClosedSprint) {
                                $stmtUpClosed->execute([$st['title'], $stParent, $st['position'], $stId, $id]);
                                SubtaskStateHelper::setClosedSprintSubtaskDelta($db, $stId, $effectiveSprintId, $effectiveSprintNumber, $st['is_done']);
                            } else {
                                $stmtUpActive->execute([$st['title'], $st['is_done'], $stParent, $st['position'], $stId, $id]);
                            }
                            $keptIds[] = $stId;
                            $depthMap[$stId] = $depth;
                            $resolvedParentMap[$stId] = $stParent;
                            $tempIdMap[$st['temp_id']] = $stId;
                        } else {
                            $liveDone = $isClosedSprint ? 0 : $st['is_done'];
                            $stmtIns->execute([$id, $stParent, $st['title'], $liveDone, $st['position'], $subtaskCreatedSprintId]);
                            $newId = (int)$db->lastInsertId();
                            if ($isClosedSprint && $st['is_done'] === 1) {
                                SubtaskStateHelper::setClosedSprintSubtaskDelta($db, $newId, $effectiveSprintId, $effectiveSprintNumber, 1);
                            }
                            $keptIds[] = $newId;
                            $depthMap[$newId] = $depth;
                            $resolvedParentMap[$newId] = $stParent;
                            $tempIdMap[$st['temp_id']] = $newId;
                        }
                    }

                    if (!$progressed) {
                        // Briser un éventuel cycle ou parent introuvable en rattachant à la racine
                        foreach ($nextPending as &$orphan) {
                            $orphan['parent_id'] = null;
                            $orphan['parent_temp_id'] = null;
                        }
                        unset($orphan);
                    }
                    $pending = $nextPending;
                }

                $toDelete = array_diff($existingIds, $keptIds);
                foreach ($toDelete as $delId) {
                    SubtaskStateHelper::deleteSubtreeInSprint($db, $id, (int)$delId, $effectiveSprintId);
                }
            }

            $db->commit();
            Response::success(null, 'Tâche mise à jour');
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
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

        $body = Request::jsonBody();
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

        // Valider statut et logement AVANT d'ouvrir la transaction
        $hasStatusChange = array_key_exists('status', $body) && $body['status'] !== null;
        $targetStatus = null;
        if ($hasStatusChange) {
            if ($task['status'] === 'pending') {
                Response::error("Une tâche en attente (pending) ne peut pas changer de statut avant la clôture du sprint.", 400);
            }
            $targetStatus = Request::string($body, 'status');
            if (!in_array($targetStatus, ['todo', 'in_progress', 'blocked', 'done'], true)) {
                Response::error('Statut invalide', 400);
            }
        }

        $hasPropertyChange = array_key_exists('property_id', $body);
        $newPropertyId = null;
        if ($hasPropertyChange) {
            $rawPid = $body['property_id'];
            if ($rawPid !== null && $rawPid !== '' && (int)$rawPid <= 0) {
                Response::error('Identifiant de logement invalide.', 400);
            }
            $newPropertyId = ($rawPid !== null && $rawPid !== '') ? (int)$rawPid : null;
            if ($newPropertyId !== null) {
                $mustBeActive = ($task['sprint_status'] === 'active' && (int)$newPropertyId !== (int)($task['property_id'] ?? 0));
                $this->assertPropertiesExist($db, [$newPropertyId], $mustBeActive);
            }
        }

        $effectiveSprintId = (int)$task['sprint_id'];

        $db->beginTransaction();
        try {
            if ($hasStatusChange && $targetStatus !== null) {
                $stmtStatus = $db->prepare("UPDATE sprint_tasks SET status = ? WHERE id = ?");
                $stmtStatus->execute([$targetStatus, $task['sprint_task_id']]);
            }

            if ($hasPropertyChange) {
                $stmtProp = $db->prepare("UPDATE tasks SET property_id = ? WHERE id = ?");
                $stmtProp->execute([$newPropertyId, $taskId]);
            }

            // Mise à jour de l'ordre des tâches en ne modifiant que les positions qui changent
            if (!empty($body['ordered_task_ids']) && is_array($body['ordered_task_ids'])) {
                $stmtAll = $db->prepare("
                    SELECT task_id, position
                    FROM sprint_tasks
                    WHERE sprint_id = ?
                    ORDER BY position ASC, task_id ASC
                ");
                $stmtAll->execute([$effectiveSprintId]);
                $rows = $stmtAll->fetchAll();

                $allSprintTaskIds = [];
                $currentPosByTaskId = [];
                foreach ($rows as $row) {
                    $tid = (int)$row['task_id'];
                    $allSprintTaskIds[] = $tid;
                    $currentPosByTaskId[$tid] = (int)$row['position'];
                }

                $orderedSubset = [];
                foreach ($body['ordered_task_ids'] as $rawId) {
                    $tid = (int)$rawId;
                    if ($tid > 0 && isset($currentPosByTaskId[$tid]) && !in_array($tid, $orderedSubset, true)) {
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
                        $newPos = $posIdx + 1;
                        if (($currentPosByTaskId[$tid] ?? -1) !== $newPos) {
                            $stmtUpPos->execute([$newPos, $effectiveSprintId, $tid]);
                        }
                    }
                }
            }

            $db->commit();
            Response::success(null, 'Ordre mis à jour');
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
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

        $body = Request::jsonBody();
        $sprintId = !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null;

        $task = $this->resolveTaskInSprint($db, $id, $sprintId);
        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, 'changer le statut de');

        if ($task['status'] === 'pending') {
            Response::error("Une tâche en attente (pending) ne peut pas changer de statut avant la clôture du sprint.", 400);
        }

        $newStatus = Request::string($body, 'status');
        if (!in_array($newStatus, ['todo', 'in_progress', 'blocked', 'done'], true)) {
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

        $body = Request::jsonBody();
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

        $body = Request::jsonBody();
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

        $body = Request::jsonBody();
        $sprintId = !empty($body['sprint_id']) ? (int)$body['sprint_id'] : null;

        $task = $this->resolveTaskInSprint($db, $id, $sprintId);
        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        $this->assertCanModifyTask($currentUser, $task, "ajouter des sous-tâches à");

        $title = Request::string($body, 'title');
        if ($title === '' || mb_strlen($title) > 255) {
            Response::error('Titre de la sous-tâche requis (255 caractères max).', 400);
        }

        $parentId = !empty($body['parent_id']) ? (int)$body['parent_id'] : null;
        if ($parentId) {
            $stmtTaskSubs = $db->prepare("SELECT id, parent_id, created_sprint_id, deleted_sprint_id FROM subtasks WHERE task_id = ?");
            $stmtTaskSubs->execute([$id]);
            $byId = [];
            foreach ($stmtTaskSubs->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $byId[(int)$row['id']] = $row;
            }

            $sprintNumMap = SubtaskStateHelper::getSprintNumberMap($db);
            $targetSprintNum = (int)$task['sprint_number'];

            if (!isset($byId[$parentId]) || !SubtaskStateHelper::isVisibleInSprint($byId[$parentId], $targetSprintNum, $sprintNumMap)) {
                Response::error('Sous-tâche parente introuvable pour cette tâche', 400);
            }

            // Vérifier la profondeur maximale (4 niveaux : 0..3) en mémoire sans requêtes N+1
            $depth = 0;
            $cursor = $byId[$parentId]['parent_id'] ? (int)$byId[$parentId]['parent_id'] : null;
            $visited = [$parentId => true];
            while ($cursor !== null && isset($byId[$cursor]) && !isset($visited[$cursor]) && $depth < 4) {
                $visited[$cursor] = true;
                $depth++;
                $cursor = $byId[$cursor]['parent_id'] ? (int)$byId[$cursor]['parent_id'] : null;
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

        $body = Request::jsonBody();
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

        $sprintNumMap = SubtaskStateHelper::getSprintNumberMap($db);
        if (!SubtaskStateHelper::isVisibleInSprint($subtask, (int)$task['sprint_number'], $sprintNumMap)) {
            Response::error('Sous-tâche introuvable dans ce sprint', 404);
        }

        if ($task['sprint_status'] === 'closed') {
            // Action admin sur un sprint archivé : basculer uniquement le delta de ce sprint
            $resolvedMap = SubtaskStateHelper::fetchResolvedStatesBySubtaskIds(
                $db,
                [$subtaskId],
                (int)$task['sprint_number'],
                false
            );
            $currentDone = $resolvedMap[$subtaskId] ?? 0;
            $newDone = $currentDone ? 0 : 1;
            SubtaskStateHelper::setClosedSprintSubtaskDelta(
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

        $body = Request::jsonBody();
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

        $sprintNumMap = SubtaskStateHelper::getSprintNumberMap($db);
        if (!SubtaskStateHelper::isVisibleInSprint($subtask, (int)$task['sprint_number'], $sprintNumMap)) {
            Response::error('Sous-tâche introuvable dans ce sprint', 404);
        }

        SubtaskStateHelper::deleteSubtreeInSprint(
            $db,
            (int)$subtask['task_id'],
            $subtaskId,
            (int)$task['sprint_id']
        );

        Response::success(null, 'Sous-tâche supprimée');
    }
}
