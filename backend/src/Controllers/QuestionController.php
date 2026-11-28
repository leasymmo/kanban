<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use App\Request;
use App\Pagination\CursorPaginator;
use App\Pagination\PageRequest;
use App\Pagination\PaginatedResult;
use App\Pagination\PaginationException;
use App\Pagination\QueryFilter;
use App\Pagination\Specs\QuestionQuerySpec;
use PDO;

class QuestionController {
    /**
     * Résout le sprint ciblé (explicitement ou sprint actif / le plus récent).
     */
    private static function resolveSprintRow(PDO $db, ?int $sprintId): ?array {
        if ($sprintId !== null && $sprintId > 0) {
            $stmt = $db->prepare("SELECT id, number, status FROM sprints WHERE id = ? LIMIT 1");
            $stmt->execute([$sprintId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                Response::error('Sprint introuvable', 404);
            }
            return $row;
        }

        $row = $db->query("SELECT id, number, status FROM sprints ORDER BY (status = 'active') DESC, number DESC LIMIT 1")->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Moteur partagé de pagination par curseur, filtres SQL et tri pour les questions.
     *
     * @param array<string, mixed> $params
     * @param array<string, mixed> $currentUser
     * @return array<string, mixed>
     */
    public static function executePaginated(
        PDO $db,
        ?array $sprint,
        array $currentUser,
        array $params,
        int $defaultLimit = 20
    ): array {
        $isAdmin = (($currentUser['role'] ?? '') === 'admin');
        if (!$sprint) {
            $sortSpec = QuestionQuerySpec::buildSortSpec($db);
            $pageRequest = PageRequest::fromArray($params, $sortSpec, $defaultLimit);
            $empty = (new PaginatedResult([], $pageRequest->getLimit(), false, false, null, null, 0))->toArray();
            return array_merge([
                'sprint_id' => 0,
                'is_read_only' => false,
                'facets' => [
                    'counts_by_user_id' => [],
                    'summary' => ['total' => 0, 'decided' => 0, 'undecided' => 0],
                ],
            ], $empty);
        }

        $sprintId = (int)$sprint['id'];
        $sprintStatus = (string)($sprint['status'] ?? 'active');
        $isReadOnly = ($sprintStatus === 'closed' && !$isAdmin);

        $sortSpec = QuestionQuerySpec::buildSortSpec($db);
        $pageRequest = PageRequest::fromArray($params, $sortSpec, $defaultLimit);
        $sortByKey = $pageRequest->getSortField()->getKey();

        $filter = QuestionQuerySpec::buildFilter($params, $currentUser, $sprintId);
        $query = QuestionQuerySpec::buildQuery($filter, $sortByKey);
        $paginator = new CursorPaginator();
        $result = $paginator->paginate(
            $db,
            $query,
            $pageRequest,
            static fn(array $rows): array => QuestionQuerySpec::hydrateRows($db, $rows, $sprintStatus, $currentUser)
        );

        $hasCursor = $pageRequest->getCursor() !== null;
        $includeFacetsParam = QueryFilter::parseOptionalBool($params, 'include_facets');
        $shouldIncludeFacets = ($includeFacetsParam === 1) || ($includeFacetsParam === null && !$hasCursor);

        $payload = array_merge([
            'sprint_id' => $sprintId,
            'is_read_only' => $isReadOnly,
            'sort' => [
                'by' => $sortByKey,
                'direction' => $pageRequest->getSortDirection(),
            ],
        ], $result->toArray());

        if ($shouldIncludeFacets) {
            $payload['facets'] = QuestionQuerySpec::computeFacets($db, $params, $currentUser, $sprintId);
        }

        return $payload;
    }

    /**
     * GET /api/questions?sprint_id=X&limit=20&sort_by=created_at&sort_direction=asc&...
     */
    public function list(): void {
        $currentUser = Auth::requireAuth();
        $db = Database::getConnection();

        try {
            $sprintIdParam = null;
            if (isset($_GET['sprint_id']) && $_GET['sprint_id'] !== '') {
                if (!ctype_digit((string)$_GET['sprint_id']) || (int)$_GET['sprint_id'] <= 0) {
                    Response::error('Identifiant de sprint invalide.', 400);
                }
                $sprintIdParam = (int)$_GET['sprint_id'];
            }

            $sprint = self::resolveSprintRow($db, $sprintIdParam);
            $payload = self::executePaginated($db, $sprint, $currentUser, $_GET, 20);
            Response::json(array_merge(['success' => true], $payload));
        } catch (PaginationException $e) {
            Response::error($e->getMessage(), $e->getStatusCode());
        }
    }

    /**
     * POST /api/questions
     */
    public function create(): void {
        $currentUser = Auth::requireWrite();
        $db = Database::getConnection();

        $body = Request::jsonBody();
        $title = Request::string($body, 'title');
        $details = Request::string($body, 'details');
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
        $newQuestionId = (int)$db->lastInsertId();
        $hydrated = QuestionQuerySpec::hydrateById($db, $newQuestionId, (string)$sprint['status'], $currentUser);

        Response::json([
            'success' => true,
            'question_id' => $newQuestionId,
            'question' => $hydrated,
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

        $body = Request::jsonBody();
        if (array_key_exists('title', $body)) {
            $title = Request::string($body, 'title');
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
            $trimmedDetails = Request::string($body, 'details');
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

        $hydrated = QuestionQuerySpec::hydrateById($db, $id, (string)$question['sprint_status'], $currentUser);

        Response::json([
            'success' => true,
            'message' => 'Question mise à jour',
            'question' => $hydrated
        ]);
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

        $body = Request::jsonBody();
        $content = Request::string($body, 'content');
        if ($content === '') {
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

        $body = Request::jsonBody();
        $content = Request::string($body, 'content');
        if ($content === '') {
            Response::error('Le contenu ne peut pas être vide', 400);
        }

        $stmtUpdate = $db->prepare("UPDATE question_answers SET content = ? WHERE id = ?");
        $stmtUpdate->execute([$content, $answerId]);

        Response::json([
            'success' => true,
            'question_id' => (int)$answer['question_id'],
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

        Response::json([
            'success' => true,
            'question_id' => (int)$answer['question_id'],
            'message' => 'Réponse supprimée'
        ]);
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

        $body = Request::jsonBody();
        $finalAnswer = array_key_exists('final_answer', $body) ? Request::string($body, 'final_answer') : null;
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
