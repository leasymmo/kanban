<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use PDO;

class QuestionController {
    /**
     * GET /api/questions?sprint_id=X
     */
    public function list(): void {
        Auth::requireAuth();
        $db = Database::getConnection();

        $sprintId = isset($_GET['sprint_id']) ? (int)$_GET['sprint_id'] : 0;
        if ($sprintId <= 0) {
            // Dernier sprint actif par défaut
            $stmtSprint = $db->query("SELECT id FROM sprints ORDER BY number DESC LIMIT 1");
            $sprintId = (int)($stmtSprint->fetch()['id'] ?? 0);
        }

        $stmt = $db->prepare("
            SELECT q.*,
                   u.name as user_name, u.initials as user_initials, u.avatar_color as user_color,
                   uc.name as created_by_name
            FROM questions q
            JOIN users u ON u.id = q.user_id
            JOIN users uc ON uc.id = q.created_by
            WHERE q.sprint_id = ?
            ORDER BY q.user_id ASC, q.id ASC
        ");
        $stmt->execute([$sprintId]);
        $questions = $stmt->fetchAll();

        $currentUser = Auth::getCurrentUser();
        foreach ($questions as &$q) {
            $q['can_edit'] = ($currentUser['role'] === 'admin')
                || ($currentUser['role'] === 'write' && $q['user_id'] == $currentUser['id']);
            $q['can_delete'] = $q['can_edit'];
        }

        Response::json([
            'success' => true,
            'sprint_id' => $sprintId,
            'questions' => $questions
        ]);
    }

    /**
     * POST /api/questions
     */
    public function create(): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $title = trim($body['title'] ?? '');
        $details = trim($body['details'] ?? '');
        $sprintId = (int)($body['sprint_id'] ?? 0);

        if (empty($title) || $sprintId <= 0) {
            Response::error('Titre de la question et sprint requis', 400);
        }

        // Règle du brief :
        // Un compte écriture : automatiquement associé au compte connecté
        // Un compte admin : peut choisir l'associé ciblé
        $targetUserId = (int)$currentUser['id'];
        if ($currentUser['role'] === 'admin' && !empty($body['user_id'])) {
            $targetUserId = (int)$body['user_id'];
        }

        $stmt = $db->prepare("
            INSERT INTO questions (sprint_id, user_id, created_by, title, details, status)
            VALUES (?, ?, ?, ?, ?, 'open')
        ");
        $stmt->execute([$sprintId, $targetUserId, $currentUser['id'], $title, $details]);

        Response::json([
            'success' => true,
            'question_id' => $db->lastInsertId(),
            'message' => 'Question ajoutée avec succès'
        ]);
    }

    /**
     * PUT/PATCH /api/questions/{id}
     */
    public function update(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM questions WHERE id = ?");
        $stmt->execute([$id]);
        $question = $stmt->fetch();

        if (!$question) {
            Response::error('Question introuvable', 404);
        }

        $canEdit = ($currentUser['role'] === 'admin')
            || ($currentUser['role'] === 'write' && $question['user_id'] == $currentUser['id']);

        if (!$canEdit) {
            Response::error("Vous ne pouvez modifier que vos propres questions", 403);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $title = isset($body['title']) ? trim($body['title']) : $question['title'];
        $details = isset($body['details']) ? trim($body['details']) : $question['details'];
        $status = in_array($body['status'] ?? '', ['open', 'discussed', 'resolved']) ? $body['status'] : $question['status'];

        $userId = $question['user_id'];
        if ($currentUser['role'] === 'admin' && !empty($body['user_id'])) {
            $userId = (int)$body['user_id'];
        }

        $stmtUpdate = $db->prepare("
            UPDATE questions
            SET title = ?, details = ?, status = ?, user_id = ?
            WHERE id = ?
        ");
        $stmtUpdate->execute([$title, $details, $status, $userId, $id]);

        Response::success(null, 'Question mise à jour');
    }

    /**
     * DELETE /api/questions/{id}
     */
    public function delete(int $id): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $stmt = $db->prepare("SELECT * FROM questions WHERE id = ?");
        $stmt->execute([$id]);
        $question = $stmt->fetch();

        if (!$question) {
            Response::error('Question introuvable', 404);
        }

        $canDelete = ($currentUser['role'] === 'admin')
            || ($currentUser['role'] === 'write' && $question['user_id'] == $currentUser['id']);

        if (!$canDelete) {
            Response::error("Vous ne pouvez supprimer que vos propres questions", 403);
        }

        $stmtDel = $db->prepare("DELETE FROM questions WHERE id = ?");
        $stmtDel->execute([$id]);

        Response::success(null, 'Question supprimée');
    }
}
