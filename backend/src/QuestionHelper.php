<?php

namespace App;

use PDO;

/**
 * Hydratation partagée des questions d'un sprint et de leurs propositions de réponse.
 */
class QuestionHelper {
    /**
     * Charge toutes les questions d'un sprint, leurs réponses collaboratives et calcule les droits.
     */
    public static function hydrateQuestionsForSprint(
        PDO $db,
        int $sprintId,
        string $sprintStatus,
        array $currentUser
    ): array {
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
        $stmtQ->execute([$sprintId]);
        $questions = $stmtQ->fetchAll();

        if (empty($questions)) {
            return [];
        }

        $qIds = array_column($questions, 'id');
        $answersMap = [];
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
            $answersMap[(int)$ans['question_id']][] = $ans;
        }

        $isAdmin = ($currentUser['role'] === 'admin');
        $isWrite = ($currentUser['role'] === 'write');
        $isSprintClosed = ($sprintStatus === 'closed');
        $currentUserId = (int)$currentUser['id'];

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
            $q['answers'] = $rawAnswers;
        }

        return $questions;
    }
}
