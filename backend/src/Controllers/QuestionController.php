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
                   uc.name as created_by_name,
                   ua.name as answered_by_name
            FROM questions q
            JOIN users u ON u.id = q.user_id
            JOIN users uc ON uc.id = q.created_by
            LEFT JOIN users ua ON ua.id = q.answered_by
            WHERE q.sprint_id = ?
            ORDER BY q.user_id ASC, q.id ASC
        ");
        $stmt->execute([$sprintId]);
        $questions = $stmt->fetchAll();

        // Récupérer les réponses collaboratives
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

        $currentUser = Auth::getCurrentUser();
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

        $stmtSprint = $db->prepare("SELECT id, status FROM sprints WHERE id = ? LIMIT 1");
        $stmtSprint->execute([$sprintId]);
        $sprint = $stmtSprint->fetch();
        if (!$sprint) {
            Response::error('Sprint introuvable', 404);
        }
        if ($sprint['status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Sprint clôturé : création interdite en lecture seule', 403);
        }

        $targetUserId = (int)$currentUser['id'];
        if ($currentUser['role'] === 'admin' && !empty($body['user_id'])) {
            $targetUserId = (int)$body['user_id'];
            $stmtU = $db->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
            $stmtU->execute([$targetUserId]);
            if (!$stmtU->fetch()) {
                Response::error('Utilisateur concerné introuvable', 400);
            }
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

        $stmt = $db->prepare("
            SELECT q.*, s.status as sprint_status
            FROM questions q
            JOIN sprints s ON s.id = q.sprint_id
            WHERE q.id = ?
        ");
        $stmt->execute([$id]);
        $question = $stmt->fetch();

        if (!$question) {
            Response::error('Question introuvable', 404);
        }

        if ($question['sprint_status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Sprint clôturé : modification interdite en lecture seule', 403);
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
            $stmtU = $db->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
            $stmtU->execute([$userId]);
            if (!$stmtU->fetch()) {
                Response::error('Utilisateur concerné introuvable', 400);
            }
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

        $stmt = $db->prepare("
            SELECT q.*, s.status as sprint_status
            FROM questions q
            JOIN sprints s ON s.id = q.sprint_id
            WHERE q.id = ?
        ");
        $stmt->execute([$id]);
        $question = $stmt->fetch();

        if (!$question) {
            Response::error('Question introuvable', 404);
        }

        if ($question['sprint_status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Sprint clôturé : suppression interdite en lecture seule', 403);
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

    /**
     * POST /api/questions/{id}/answers
     * Ajoute une proposition de réponse collaborative par n'importe quel associé
     */
    public function addAnswer(int $questionId): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $stmtQ = $db->prepare("
            SELECT q.id, s.status as sprint_status
            FROM questions q
            JOIN sprints s ON s.id = q.sprint_id
            WHERE q.id = ?
        ");
        $stmtQ->execute([$questionId]);
        $qRow = $stmtQ->fetch();
        if (!$qRow) {
            Response::error('Question introuvable', 404);
        }
        if ($qRow['sprint_status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Sprint clôturé en lecture seule', 403);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $content = trim($body['content'] ?? '');
        if (empty($content)) {
            Response::error('Le contenu de la réponse ne peut pas être vide', 400);
        }

        $stmt = $db->prepare("
            INSERT INTO question_answers (question_id, user_id, content)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$questionId, $currentUser['id'], $content]);
        $newAnswerId = (int)$db->lastInsertId();

        Response::json([
            'success' => true,
            'message' => 'Réponse ajoutée',
            'answer' => [
                'id' => $newAnswerId,
                'question_id' => $questionId,
                'user_id' => $currentUser['id'],
                'user_name' => $currentUser['name'],
                'user_initials' => $currentUser['initials'],
                'user_color' => $currentUser['avatar_color'],
                'content' => $content,
                'created_at' => date('Y-m-d H:i:s'),
                'can_edit' => true,
                'can_delete' => true
            ]
        ], 201);
    }

    /**
     * PUT/PATCH /api/answers/{id}
     * Modifie sa propre proposition de réponse
     */
    public function updateAnswer(int $answerId): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT a.*, s.status as sprint_status
            FROM question_answers a
            JOIN questions q ON q.id = a.question_id
            JOIN sprints s ON s.id = q.sprint_id
            WHERE a.id = ?
        ");
        $stmt->execute([$answerId]);
        $answer = $stmt->fetch();

        if (!$answer) {
            Response::error('Réponse introuvable', 404);
        }

        if ($answer['sprint_status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Sprint clôturé en lecture seule', 403);
        }

        if ($currentUser['role'] !== 'admin' && $answer['user_id'] != $currentUser['id']) {
            Response::error("Vous ne pouvez modifier que vos propres propositions de réponse", 403);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $content = trim($body['content'] ?? '');
        if (empty($content)) {
            Response::error('Le contenu ne peut pas être vide', 400);
        }

        $stmtUpdate = $db->prepare("UPDATE question_answers SET content = ? WHERE id = ?");
        $stmtUpdate->execute([$content, $answerId]);

        Response::json([
            'success' => true,
            'message' => 'Réponse mise à jour',
            'content' => $content
        ]);
    }

    /**
     * DELETE /api/answers/{id}
     * Supprime sa propre proposition de réponse
     */
    public function deleteAnswer(int $answerId): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT a.*, s.status as sprint_status
            FROM question_answers a
            JOIN questions q ON q.id = a.question_id
            JOIN sprints s ON s.id = q.sprint_id
            WHERE a.id = ?
        ");
        $stmt->execute([$answerId]);
        $answer = $stmt->fetch();

        if (!$answer) {
            Response::error('Réponse introuvable', 404);
        }

        if ($answer['sprint_status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Sprint clôturé en lecture seule', 403);
        }

        if ($currentUser['role'] !== 'admin' && $answer['user_id'] != $currentUser['id']) {
            Response::error("Vous ne pouvez supprimer que vos propres réponses", 403);
        }

        $stmtDel = $db->prepare("DELETE FROM question_answers WHERE id = ?");
        $stmtDel->execute([$answerId]);

        Response::success(null, 'Réponse supprimée');
    }

    /**
     * POST /api/questions/{id}/decision
     * Fixe la réponse définitive / arbitrage de réunion
     */
    public function setDecision(int $questionId): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $stmt = $db->prepare("
            SELECT q.*, s.status as sprint_status
            FROM questions q
            JOIN sprints s ON s.id = q.sprint_id
            WHERE q.id = ?
        ");
        $stmt->execute([$questionId]);
        $question = $stmt->fetch();

        if (!$question) {
            Response::error('Question introuvable', 404);
        }

        if ($question['sprint_status'] === 'closed' && $currentUser['role'] !== 'admin') {
            Response::error('Sprint clôturé : arbitrage interdit en lecture seule', 403);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $finalAnswer = isset($body['final_answer']) ? trim($body['final_answer']) : null;
        if ($finalAnswer === '') {
            $finalAnswer = null;
        }
        $status = in_array($body['status'] ?? '', ['open', 'discussed', 'resolved']) ? $body['status'] : 'resolved';

        $answeredBy = !empty($finalAnswer) ? $currentUser['id'] : null;
        $answeredAt = !empty($finalAnswer) ? date('Y-m-d H:i:s') : null;

        $stmtUpdate = $db->prepare("
            UPDATE questions
            SET final_answer = ?, status = ?, answered_by = ?, answered_at = ?
            WHERE id = ?
        ");
        $stmtUpdate->execute([$finalAnswer, $status, $answeredBy, $answeredAt, $questionId]);

        Response::json([
            'success' => true,
            'message' => 'Décision enregistrée avec succès',
            'final_answer' => $finalAnswer,
            'status' => $status,
            'answered_by' => $answeredBy,
            'answered_by_name' => $currentUser['name'],
            'answered_at' => $answeredAt
        ]);
    }
}
