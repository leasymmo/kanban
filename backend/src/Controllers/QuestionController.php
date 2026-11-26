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
            // Prioriser le sprint actif, sinon le plus récent
            $stmtSprint = $db->query("SELECT id, status FROM sprints ORDER BY (status = 'active') DESC, number DESC LIMIT 1");
            $sprintRow = $stmtSprint->fetch();
            $sprintId = (int)($sprintRow['id'] ?? 0);
            $sprintStatus = $sprintRow['status'] ?? 'active';
        } else {
            $stmtSprint = $db->prepare("SELECT id, status FROM sprints WHERE id = ? LIMIT 1");
            $stmtSprint->execute([$sprintId]);
            $sprintRow = $stmtSprint->fetch();
            if (!$sprintRow) {
                Response::error('Sprint introuvable', 404);
            }
            $sprintStatus = $sprintRow['status'] ?? 'active';
        }

        $stmt = $db->prepare("
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
        $stmt->execute([$sprintId]);
        $questions = $stmt->fetchAll();

        // Récupérer les réponses collaboratives
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

        $currentUser = Auth::getCurrentUser();
        $isAdmin = ($currentUser['role'] === 'admin');
        $isWrite = ($currentUser['role'] === 'write');
        $isSprintClosed = ($sprintStatus === 'closed');

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
            'sprint_id' => $sprintId,
            'is_read_only' => ($isSprintClosed && !$isAdmin),
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

        if ($title === '' || $sprintId <= 0) {
            Response::error('Titre de la question et sprint requis', 400);
        }
        if (mb_strlen($title) > 255) {
            Response::error('L’intitulé de la question ne doit pas dépasser 255 caractères', 400);
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
            INSERT INTO questions (sprint_id, user_id, created_by, title, details)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([$sprintId, $targetUserId, $currentUser['id'], $title, $details !== '' ? $details : null]);

        Response::json([
            'success' => true,
            'question_id' => (int)$db->lastInsertId(),
            'message' => 'Question ajoutée avec succès'
        ], 201);
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
        if (array_key_exists('title', $body)) {
            $title = trim((string)$body['title']);
            if ($title === '') {
                Response::error('Le titre de la question ne peut pas être vide', 400);
            }
            if (mb_strlen($title) > 255) {
                Response::error('L’intitulé de la question ne doit pas dépasser 255 caractères', 400);
            }
        } else {
            $title = $question['title'];
        }

        if (array_key_exists('details', $body)) {
            $trimmedDetails = trim((string)$body['details']);
            $details = $trimmedDetails !== '' ? $trimmedDetails : null;
        } else {
            $details = $question['details'];
        }

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
            SET title = ?, details = ?, user_id = ?
            WHERE id = ?
        ");
        $stmtUpdate->execute([$title, $details, $userId, $id]);

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
        if ($qRow['sprint_status'] === 'closed') {
            Response::error('Sprint clôturé : les réponses indicatives ne sont plus modifiables après clôture', 403);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $content = trim($body['content'] ?? '');
        if (empty($content)) {
            Response::error('Le contenu de la réponse ne peut pas être vide', 400);
        }

        // Chaque associé ne peut proposer qu'une et une seule réponse par question
        $stmtExisting = $db->prepare("
            SELECT id FROM question_answers
            WHERE question_id = ? AND user_id = ?
            LIMIT 1
        ");
        $stmtExisting->execute([$questionId, (int)$currentUser['id']]);
        if ($stmtExisting->fetch()) {
            Response::error(
                'Vous avez déjà proposé une réponse à cette question. Modifiez ou supprimez votre réponse existante.',
                409
            );
        }

        try {
            $stmt = $db->prepare("
                INSERT INTO question_answers (question_id, user_id, content)
                VALUES (?, ?, ?)
            ");
            $stmt->execute([$questionId, (int)$currentUser['id'], $content]);
            $newAnswerId = (int)$db->lastInsertId();
        } catch (\PDOException $e) {
            if ($e->getCode() === '23000') {
                Response::error(
                    'Vous avez déjà proposé une réponse à cette question. Modifiez ou supprimez votre réponse existante.',
                    409
                );
            }
            throw $e;
        }

        Response::json([
            'success' => true,
            'message' => 'Réponse ajoutée',
            'answer' => [
                'id' => $newAnswerId,
                'question_id' => $questionId,
                'user_id' => (int)$currentUser['id'],
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

        if ($answer['sprint_status'] === 'closed') {
            Response::error('Sprint clôturé : les réponses indicatives ne sont plus modifiables après clôture', 403);
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

        if ($answer['sprint_status'] === 'closed') {
            Response::error('Sprint clôturé : les réponses indicatives ne sont plus modifiables après clôture', 403);
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
        $finalAnswer = isset($body['final_answer']) ? trim((string)$body['final_answer']) : null;
        if ($finalAnswer === '') {
            $finalAnswer = null;
        }

        $stmtUpdate = $db->prepare("
            UPDATE questions
            SET final_answer = ?
            WHERE id = ?
        ");
        $stmtUpdate->execute([$finalAnswer, $questionId]);

        Response::json([
            'success' => true,
            'message' => $finalAnswer !== null ? 'Décision enregistrée avec succès' : 'Décision supprimée',
            'final_answer' => $finalAnswer
        ]);
    }
}
