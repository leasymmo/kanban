<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use PDO;

class TaskController {
    /**
     * POST /api/tasks
     * Création d'une tâche
     */
    public function create(): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $title = trim($body['title'] ?? '');
        $sprintId = (int)($body['sprint_id'] ?? 0);

        if (empty($title) || $sprintId <= 0) {
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

        // Attribution : Seul l'admin peut attribuer à quelqu'un d'autre
        $assignedTo = null;
        if (!empty($body['assigned_to'])) {
            if ($currentUser['role'] === 'admin') {
                $assignedTo = (int)$body['assigned_to'];
            } else if ((int)$body['assigned_to'] === (int)$currentUser['id']) {
                // Un compte écriture peut s'auto-attribuer sa propre tâche s'il le souhaite
                $assignedTo = (int)$currentUser['id'];
            } else {
                // Non autorisé à assigner à un tiers
                Response::error("Seul un administrateur peut attribuer une tâche à un autre associé.", 403);
            }
        }

        $propertyId = !empty($body['property_id']) ? (int)$body['property_id'] : null;
        $status = in_array($body['status'] ?? '', ['todo', 'in_progress', 'blocked', 'done']) ? $body['status'] : 'todo';
        $priority = in_array($body['priority'] ?? '', ['low', 'medium', 'high']) ? $body['priority'] : 'medium';
        $description = trim($body['description'] ?? '');
        $dueDate = !empty($body['due_date']) ? $body['due_date'] : null;
        $isUnplanned = !empty($body['is_unplanned']) ? 1 : 0;

        // Position
        $stmtPos = $db->prepare("SELECT MAX(position) as max_pos FROM tasks WHERE sprint_id = ? AND status = ?");
        $stmtPos->execute([$sprintId, $status]);
        $maxPos = (int)($stmtPos->fetch()['max_pos'] ?? 0);
        $position = $maxPos + 1;

        $stmt = $db->prepare("
            INSERT INTO tasks (
                sprint_id, title, description, status, assigned_to, created_by,
                property_id, priority, due_date, position, is_unplanned
            ) VALUES (
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?
            )
        ");
        $stmt->execute([
            $sprintId, $title, $description, $status, $assignedTo, $currentUser['id'],
            $propertyId, $priority, $dueDate, $position, $isUnplanned
        ]);
        $taskId = (int)$db->lastInsertId();

        // Insertion des sous-tâches si fournies
        if (!empty($body['subtasks']) && is_array($body['subtasks'])) {
            $stmtSub = $db->prepare("INSERT INTO subtasks (task_id, title, is_done, position) VALUES (?, ?, 0, ?)");
            $subPos = 1;
            foreach ($body['subtasks'] as $subTitle) {
                $trimmed = trim(is_string($subTitle) ? $subTitle : ($subTitle['title'] ?? ''));
                if (!empty($trimmed)) {
                    $stmtSub->execute([$taskId, $trimmed, $subPos++]);
                }
            }
        }

        Response::json([
            'success' => true,
            'task_id' => $taskId,
            'message' => 'Tâche créée avec succès'
        ]);
    }

    /**
     * PUT/PATCH /api/tasks/{id}
     * Modification d'une tâche
     */
    public function update(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        // Récupération de la tâche
        $stmt = $db->prepare("
            SELECT t.*, s.status as sprint_status
            FROM tasks t
            JOIN sprints s ON s.id = t.sprint_id
            WHERE t.id = ?
        ");
        $stmt->execute([$id]);
        $task = $stmt->fetch();

        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        // Vérification des droits selon le brief
        $canEdit = false;
        if ($currentUser['role'] === 'admin') {
            $canEdit = true;
        } else if ($task['sprint_status'] === 'closed') {
            Response::error('Sprint clôturé : modification interdite en lecture seule', 403);
        } else if ($task['assigned_to'] == $currentUser['id']) {
            $canEdit = true;
        } else if ($task['assigned_to'] === null && $task['created_by'] == $currentUser['id']) {
            $canEdit = true;
        }

        if (!$canEdit) {
            Response::error("Vous n'avez pas l'autorisation de modifier cette tâche", 403);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $title = isset($body['title']) ? trim($body['title']) : $task['title'];
        $description = isset($body['description']) ? trim($body['description']) : $task['description'];
        $status = in_array($body['status'] ?? '', ['todo', 'in_progress', 'blocked', 'done']) ? $body['status'] : $task['status'];
        $priority = in_array($body['priority'] ?? '', ['low', 'medium', 'high']) ? $body['priority'] : $task['priority'];
        $propertyId = array_key_exists('property_id', $body)
            ? (!empty($body['property_id']) ? (int)$body['property_id'] : null)
            : $task['property_id'];
        $dueDate = array_key_exists('due_date', $body)
            ? (!empty($body['due_date']) ? $body['due_date'] : null)
            : $task['due_date'];

        // Règle d'attribution : SEUL un admin peut modifier assigned_to
        $assignedTo = $task['assigned_to'];
        if (array_key_exists('assigned_to', $body)) {
            if ($currentUser['role'] === 'admin') {
                $assignedTo = !empty($body['assigned_to']) ? (int)$body['assigned_to'] : null;
            } else if ((int)($body['assigned_to'] ?? 0) !== (int)$task['assigned_to']) {
                Response::error("Seul un administrateur peut modifier l'attribution d'une tâche.", 403);
            }
        }

        $stmtUpdate = $db->prepare("
            UPDATE tasks
            SET title = ?, description = ?, status = ?, assigned_to = ?,
                property_id = ?, priority = ?, due_date = ?
            WHERE id = ?
        ");
        $stmtUpdate->execute([
            $title, $description, $status, $assignedTo,
            $propertyId, $priority, $dueDate, $id
        ]);

        Response::success(null, 'Tâche mise à jour');
    }

    /**
     * PATCH /api/tasks/{id}/status
     * Changement rapide de statut (glisser-déposer ou clic)
     */
    public function updateStatus(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT t.*, s.status as sprint_status
            FROM tasks t
            JOIN sprints s ON s.id = t.sprint_id
            WHERE t.id = ?
        ");
        $stmt->execute([$id]);
        $task = $stmt->fetch();

        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        if ($task['sprint_status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Sprint clôturé en lecture seule', 403);
        }

        // Vérification des droits d'action sur la tâche
        if ($currentUser['role'] !== 'admin') {
            $isAssignedToMe = ($task['assigned_to'] == $currentUser['id']);
            $isCreatedByMeUnassigned = ($task['assigned_to'] === null && $task['created_by'] == $currentUser['id']);
            if (!$isAssignedToMe && !$isCreatedByMeUnassigned) {
                Response::error("Vous ne pouvez changer le statut que de vos propres tâches.", 403);
            }
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $newStatus = $body['status'] ?? '';
        if (!in_array($newStatus, ['todo', 'in_progress', 'blocked', 'done'])) {
            Response::error('Statut invalide', 400);
        }

        $stmtUpdate = $db->prepare("UPDATE tasks SET status = ? WHERE id = ?");
        $stmtUpdate->execute([$newStatus, $id]);

        Response::success(['status' => $newStatus], 'Statut mis à jour');
    }

    /**
     * DELETE /api/tasks/{id}
     */
    public function delete(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT t.*, s.status as sprint_status
            FROM tasks t
            JOIN sprints s ON s.id = t.sprint_id
            WHERE t.id = ?
        ");
        $stmt->execute([$id]);
        $task = $stmt->fetch();

        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        if ($currentUser['role'] !== 'admin') {
            if ($task['sprint_status'] === 'closed') {
                Response::error('Sprint clôturé en lecture seule', 403);
            }
            $canDelete = ($task['assigned_to'] == $currentUser['id'])
                || ($task['assigned_to'] === null && $task['created_by'] == $currentUser['id']);
            if (!$canDelete) {
                Response::error("Vous ne pouvez supprimer que vos propres tâches.", 403);
            }
        }

        $stmtDel = $db->prepare("DELETE FROM tasks WHERE id = ?");
        $stmtDel->execute([$id]);

        Response::success(null, 'Tâche supprimée');
    }

    /**
     * POST /api/tasks/{id}/subtasks
     * Ajout d'une sous-tâche
     */
    public function addSubtask(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM tasks WHERE id = ?");
        $stmt->execute([$id]);
        $task = $stmt->fetch();
        if (!$task) {
            Response::error('Tâche introuvable', 404);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $title = trim($body['title'] ?? '');
        if (empty($title)) {
            Response::error('Titre de la sous-tâche requis', 400);
        }

        $stmtPos = $db->prepare("SELECT MAX(position) as max_pos FROM subtasks WHERE task_id = ?");
        $stmtPos->execute([$id]);
        $maxPos = (int)($stmtPos->fetch()['max_pos'] ?? 0);

        $stmtInsert = $db->prepare("INSERT INTO subtasks (task_id, title, is_done, position) VALUES (?, ?, 0, ?)");
        $stmtInsert->execute([$id, $title, $maxPos + 1]);

        Response::json([
            'success' => true,
            'subtask_id' => $db->lastInsertId(),
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

        $stmt = $db->prepare("
            SELECT st.*, t.sprint_id, t.assigned_to, t.created_by, s.status as sprint_status
            FROM subtasks st
            JOIN tasks t ON t.id = st.task_id
            JOIN sprints s ON s.id = t.sprint_id
            WHERE st.id = ?
        ");
        $stmt->execute([$subtaskId]);
        $subtask = $stmt->fetch();

        if (!$subtask) {
            Response::error('Sous-tâche introuvable', 404);
        }

        if ($subtask['sprint_status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Sprint clôturé en lecture seule', 403);
        }

        $newDone = $subtask['is_done'] ? 0 : 1;
        $stmtUpdate = $db->prepare("UPDATE subtasks SET is_done = ? WHERE id = ?");
        $stmtUpdate->execute([$newDone, $subtaskId]);

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

        $stmt = $db->prepare("
            SELECT st.*, t.assigned_to, t.created_by, s.status as sprint_status
            FROM subtasks st
            JOIN tasks t ON t.id = st.task_id
            JOIN sprints s ON s.id = t.sprint_id
            WHERE st.id = ?
        ");
        $stmt->execute([$subtaskId]);
        $subtask = $stmt->fetch();

        if (!$subtask) {
            Response::error('Sous-tâche introuvable', 404);
        }

        if ($currentUser['role'] !== 'admin') {
            if ($subtask['sprint_status'] === 'closed') {
                Response::error('Sprint clôturé en lecture seule', 403);
            }
            $canDelete = ($subtask['assigned_to'] == $currentUser['id'])
                || ($subtask['assigned_to'] === null && $subtask['created_by'] == $currentUser['id']);
            if (!$canDelete) {
                Response::error("Non autorisé à supprimer cette sous-tâche", 403);
            }
        }

        $stmtDel = $db->prepare("DELETE FROM subtasks WHERE id = ?");
        $stmtDel->execute([$subtaskId]);

        Response::success(null, 'Sous-tâche supprimée');
    }
}
