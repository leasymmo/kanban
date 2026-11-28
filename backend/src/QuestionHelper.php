<?php

declare(strict_types=1);

namespace App;

use PDO;

/**
 * Hydratation partagée des questions d'un sprint et de leurs propositions de réponse.
 */
class QuestionHelper
{
    /**
     * Hydrate un lot déjà sélectionné/paginé de questions (1 requête batch pour les réponses, 0 N+1).
     *
     * @param array<int, array<string, mixed>> $questions
     * @param array<string, mixed> $currentUser
     * @return array<int, array<string, mixed>>
     */
    public static function hydrateQuestionRows(
        PDO $db,
        array $questions,
        string $sprintStatus,
        array $currentUser
    ): array {
        if (empty($questions)) {
            return [];
        }

        $qIds = array_values(array_unique(array_map(static fn(array $row): int => (int)$row['id'], $questions)));
        $answersMap = [];

        $inClause = implode(',', array_fill(0, count($qIds), '?'));
        $stmtAnswers = $db->prepare("
            SELECT a.id, a.question_id, a.user_id, a.content, a.created_at, a.updated_at,
                   COALESCE(u.name, 'Ancien associé') AS user_name,
                   COALESCE(u.initials, '?') AS user_initials,
                   COALESCE(u.avatar_color, '#64748B') AS user_color
            FROM question_answers a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE a.question_id IN ({$inClause})
            ORDER BY a.created_at ASC, a.id ASC
        ");
        $stmtAnswers->execute($qIds);
        while ($ans = $stmtAnswers->fetch(PDO::FETCH_ASSOC)) {
            $answersMap[(int)$ans['question_id']][] = $ans;
        }

        $isAdmin = (($currentUser['role'] ?? '') === 'admin');
        $isWrite = (($currentUser['role'] ?? '') === 'write');
        $isSprintClosed = ($sprintStatus === 'closed');
        $currentUserId = (int)($currentUser['id'] ?? 0);

        foreach ($questions as &$q) {
            $q['id'] = (int)$q['id'];
            $q['sprint_id'] = (int)$q['sprint_id'];
            $q['user_id'] = $q['user_id'] !== null ? (int)$q['user_id'] : null;
            $q['created_by'] = $q['created_by'] !== null ? (int)$q['created_by'] : null;

            $q['can_edit'] = $isAdmin
                || (!$isSprintClosed && $isWrite && $q['user_id'] !== null && $q['user_id'] === $currentUserId);
            $q['can_delete'] = $q['can_edit'];
            $q['can_decide'] = $isAdmin || (!$isSprintClosed && $isWrite);

            $rawAnswers = $answersMap[$q['id']] ?? [];
            foreach ($rawAnswers as &$ans) {
                $ans['id'] = (int)$ans['id'];
                $ans['question_id'] = (int)$ans['question_id'];
                $ans['user_id'] = $ans['user_id'] !== null ? (int)$ans['user_id'] : null;
                $ans['can_edit'] = !$isSprintClosed
                    && ($isAdmin || ($isWrite && $ans['user_id'] !== null && $ans['user_id'] === $currentUserId));
                $ans['can_delete'] = $ans['can_edit'];
            }
            unset($ans);
            $q['answers'] = $rawAnswers;
        }
        unset($q);

        return $questions;
    }
}
