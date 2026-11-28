<?php

declare(strict_types=1);

namespace App\Pagination\Specs;

use App\Pagination\PaginatableQuery;
use App\Pagination\PaginationException;
use App\Pagination\QueryFilter;
use App\Pagination\SortField;
use App\Pagination\SortSpec;
use App\Pagination\SortTerm;
use App\QuestionHelper;
use PDO;

/**
 * Spécification centralisée des filtres, tris, compteurs et hydratation des questions.
 */
final class QuestionQuerySpec
{
    public const VALID_DECISION_STATES = ['all', 'decided', 'undecided', 'pending'];
    public const VALID_HAS_ANSWERS = ['all', 'with_answers', 'without_answers'];

    public static function buildSortSpec(PDO $db): SortSpec
    {
        $isSqlite = ((string)$db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite');
        $titleExpr = $isSqlite ? 'q.title COLLATE NOCASE' : 'q.title';
        $userExpr = $isSqlite ? "COALESCE(u.name, 'Ancien associé') COLLATE NOCASE" : "COALESCE(u.name, 'Ancien associé')";

        $fields = [
            new SortField('created_at', [
                new SortTerm("COALESCE(q.created_at, '1970-01-01 00:00:00')", '__sort_q_created', SortTerm::TYPE_STRING, true),
                new SortTerm('q.id', '__sort_q_id', SortTerm::TYPE_INT, true),
            ], 'asc'),

            new SortField('id', [
                new SortTerm('q.id', '__sort_q_id', SortTerm::TYPE_INT, true),
            ], 'asc'),

            new SortField('alpha', [
                new SortTerm($titleExpr, '__sort_q_title', SortTerm::TYPE_STRING, true),
                new SortTerm('q.id', '__sort_q_id', SortTerm::TYPE_INT, true),
            ], 'asc'),

            new SortField('user', [
                new SortTerm($userExpr, '__sort_q_user', SortTerm::TYPE_STRING, true),
                new SortTerm('q.id', '__sort_q_id', SortTerm::TYPE_INT, false, 'ASC'),
            ], 'asc'),

            new SortField('decision_status', [
                new SortTerm("CASE WHEN q.final_answer IS NOT NULL AND TRIM(q.final_answer) != '' THEN 1 ELSE 0 END", '__sort_q_decided', SortTerm::TYPE_INT, true),
                new SortTerm('q.id', '__sort_q_id', SortTerm::TYPE_INT, false, 'ASC'),
            ], 'asc'),

            new SortField('answers_count', [
                new SortTerm('COALESCE(qa_agg.answers_count, 0)', '__sort_q_ans_cnt', SortTerm::TYPE_INT, true),
                new SortTerm('q.id', '__sort_q_id', SortTerm::TYPE_INT, false, 'ASC'),
            ], 'desc'),
        ];

        return new SortSpec($fields, 'created_at', [
            'title' => 'alpha',
            'assignee' => 'user',
        ]);
    }

    /**
     * @param array<string, mixed> $params
     * @param array<string, mixed> $currentUser
     */
    public static function buildFilter(
        array $params,
        array $currentUser,
        int $sprintId,
        bool $omitUser = false
    ): QueryFilter {
        $filter = new QueryFilter();
        $filter->addRawClause('q.sprint_id = ?', [$sprintId]);
        $currentUserId = (int)($currentUser['id'] ?? 0);

        if (!$omitUser) {
            $userParsed = self::parseUserIdsParam($params, ['user_id', 'user_ids'], $currentUserId);
            if ($userParsed !== null && $userParsed['mode'] === 'filter') {
                $filter->whereIntInOrNull('q.user_id', $userParsed['ids'], false);
            }
        }

        $createdByParsed = self::parseUserIdsParam($params, ['created_by'], $currentUserId);
        if ($createdByParsed !== null && $createdByParsed['mode'] === 'filter') {
            $filter->whereIntInOrNull('q.created_by', $createdByParsed['ids'], false);
        }

        $decisionStatus = isset($params['decision_status']) && is_string($params['decision_status'])
            ? strtolower(trim($params['decision_status']))
            : 'all';
        if ($decisionStatus !== '' && $decisionStatus !== 'all') {
            if (!in_array($decisionStatus, self::VALID_DECISION_STATES, true)) {
                throw new PaginationException("Filtre « decision_status » invalide : {$decisionStatus}.");
            }
            if ($decisionStatus === 'decided') {
                $filter->addRawClause("q.final_answer IS NOT NULL AND TRIM(q.final_answer) != ''");
            } else {
                $filter->addRawClause("(q.final_answer IS NULL OR TRIM(q.final_answer) = '')");
            }
        }

        $hasAnswers = isset($params['has_answers']) && is_string($params['has_answers'])
            ? strtolower(trim($params['has_answers']))
            : 'all';
        if ($hasAnswers !== '' && $hasAnswers !== 'all') {
            if (!in_array($hasAnswers, self::VALID_HAS_ANSWERS, true)) {
                throw new PaginationException("Filtre « has_answers » invalide : {$hasAnswers}.");
            }
            if ($hasAnswers === 'with_answers') {
                $filter->addRawClause('EXISTS (SELECT 1 FROM question_answers qa_f WHERE qa_f.question_id = q.id)');
            } else {
                $filter->addRawClause('NOT EXISTS (SELECT 1 FROM question_answers qa_f WHERE qa_f.question_id = q.id)');
            }
        }

        $answeredByMe = QueryFilter::parseOptionalBool($params, 'answered_by_me');
        if ($answeredByMe !== null && $currentUserId > 0) {
            if ($answeredByMe === 1) {
                $filter->addRawClause('EXISTS (SELECT 1 FROM question_answers qa_me WHERE qa_me.question_id = q.id AND qa_me.user_id = ?)', [$currentUserId]);
            } else {
                $filter->addRawClause('NOT EXISTS (SELECT 1 FROM question_answers qa_me WHERE qa_me.question_id = q.id AND qa_me.user_id = ?)', [$currentUserId]);
            }
        }

        $createdFrom = QueryFilter::parseOptionalDate($params, 'created_from');
        if ($createdFrom !== null) {
            $filter->addRawClause('q.created_at >= ?', [$createdFrom . ' 00:00:00']);
        }
        $createdTo = QueryFilter::parseOptionalDate($params, 'created_to');
        if ($createdTo !== null) {
            $filter->addRawClause('q.created_at <= ?', [$createdTo . ' 23:59:59']);
        }

        if (isset($params['search'])) {
            if (is_array($params['search'])) {
                throw new PaginationException('Paramètre « search » invalide.');
            }
            $search = trim((string)$params['search']);
            if ($search !== '') {
                $like = QueryFilter::escapeLike($search);
                $filter->addRawClause(
                    "(q.title LIKE ? ESCAPE '!' OR COALESCE(q.details, '') LIKE ? ESCAPE '!' OR COALESCE(q.final_answer, '') LIKE ? ESCAPE '!' OR EXISTS (SELECT 1 FROM question_answers qa_s WHERE qa_s.question_id = q.id AND qa_s.content LIKE ? ESCAPE '!'))",
                    [$like, $like, $like, $like]
                );
            }
        }

        return $filter;
    }

    public static function buildQuery(QueryFilter $filter, string $sortBy): PaginatableQuery
    {
        $select = "
            q.id, q.sprint_id, q.user_id, q.created_by,
            q.title, q.details, q.final_answer, q.created_at,
            COALESCE(u.name, 'Ancien associé') AS user_name,
            COALESCE(u.initials, '?') AS user_initials,
            COALESCE(u.avatar_color, '#64748B') AS user_color,
            COALESCE(uc.name, 'Ancien associé') AS created_by_name
        ";

        $answersJoin = '';
        if ($sortBy === 'answers_count') {
            $answersJoin = '
                LEFT JOIN (
                    SELECT question_id, COUNT(*) AS answers_count
                    FROM question_answers
                    GROUP BY question_id
                ) qa_agg ON qa_agg.question_id = q.id
            ';
        }

        $from = "
            questions q
            LEFT JOIN users u ON u.id = q.user_id
            LEFT JOIN users uc ON uc.id = q.created_by
            {$answersJoin}
        ";

        return new PaginatableQuery($select, $from, $filter, 'questions q');
    }

    /**
     * @param array<int, array<string, mixed>> $rows
     * @param array<string, mixed> $currentUser
     * @return array<int, array<string, mixed>>
     */
    public static function hydrateRows(
        PDO $db,
        array $rows,
        string $sprintStatus,
        array $currentUser
    ): array {
        return QuestionHelper::hydrateQuestionRows($db, $rows, $sprintStatus, $currentUser);
    }

    /**
     * Hydrate une question spécifique par son ID (retour de mutation).
     *
     * @param array<string, mixed> $currentUser
     * @return array<string, mixed>|null
     */
    public static function hydrateById(
        PDO $db,
        int $questionId,
        string $sprintStatus,
        array $currentUser
    ): ?array {
        $stmt = $db->prepare("
            SELECT q.id, q.sprint_id, q.user_id, q.created_by,
                   q.title, q.details, q.final_answer, q.created_at,
                   COALESCE(u.name, 'Ancien associé') AS user_name,
                   COALESCE(u.initials, '?') AS user_initials,
                   COALESCE(u.avatar_color, '#64748B') AS user_color,
                   COALESCE(uc.name, 'Ancien associé') AS created_by_name
            FROM questions q
            LEFT JOIN users u ON u.id = q.user_id
            LEFT JOIN users uc ON uc.id = q.created_by
            WHERE q.id = ?
            LIMIT 1
        ");
        $stmt->execute([$questionId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        $hydrated = QuestionHelper::hydrateQuestionRows($db, [$row], $sprintStatus, $currentUser);
        return $hydrated[0] ?? null;
    }

    /**
     * Compteurs rapides par associé + totaux décidées / à trancher.
     *
     * @param array<string, mixed> $params
     * @param array<string, mixed> $currentUser
     * @return array{
     *   counts_by_user_id: array<string, int>,
     *   summary: array{total: int, decided: int, undecided: int}
     * }
     */
    public static function computeFacets(
        PDO $db,
        array $params,
        array $currentUser,
        int $sprintId
    ): array {
        $filterNoUser = self::buildFilter($params, $currentUser, $sprintId, true);
        $countsByUser = [];
        $total = 0;
        $decided = 0;
        $undecided = 0;

        if (!$filterNoUser->isEmptyResult()) {
            $sql = "
                SELECT q.user_id,
                       COUNT(*) AS cnt,
                       SUM(CASE WHEN q.final_answer IS NOT NULL AND TRIM(q.final_answer) != '' THEN 1 ELSE 0 END) AS decided_cnt
                FROM questions q
                WHERE {$filterNoUser->getWhereSql()}
                GROUP BY q.user_id
            ";
            $stmt = $db->prepare($sql);
            foreach ($filterNoUser->getBindings() as $idx => $val) {
                $stmt->bindValue($idx + 1, $val, is_int($val) ? PDO::PARAM_INT : PDO::PARAM_STR);
            }
            $stmt->execute();

            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $cnt = (int)$row['cnt'];
                $dec = (int)$row['decided_cnt'];
                $uidKey = (string)((int)$row['user_id']);
                $countsByUser[$uidKey] = $cnt;
                $total += $cnt;
                $decided += $dec;
                $undecided += ($cnt - $dec);
            }
        }

        return [
            'counts_by_user_id' => $countsByUser,
            'summary' => [
                'total' => $total,
                'decided' => $decided,
                'undecided' => $undecided,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $params
     * @param string[] $keys
     * @return array{mode: 'none'|'filter', ids: int[]}|null
     */
    private static function parseUserIdsParam(array $params, array $keys, int $currentUserId): ?array
    {
        $found = false;
        $ids = [];
        $isAll = false;

        foreach ($keys as $key) {
            if (!array_key_exists($key, $params)) {
                continue;
            }
            $raw = $params[$key];
            if ($raw === null || $raw === '') {
                continue;
            }
            $found = true;
            $items = is_array($raw) ? $raw : explode(',', (string)$raw);
            foreach ($items as $item) {
                if (is_array($item) || is_object($item)) {
                    throw new PaginationException("Paramètre « {$key} » invalide.");
                }
                $clean = strtolower(trim((string)$item));
                if ($clean === '') {
                    continue;
                }
                if ($clean === 'all') {
                    $isAll = true;
                } elseif ($clean === 'me') {
                    if ($currentUserId > 0 && !in_array($currentUserId, $ids, true)) {
                        $ids[] = $currentUserId;
                    }
                } elseif (ctype_digit($clean) && (int)$clean > 0) {
                    $uid = (int)$clean;
                    if (!in_array($uid, $ids, true)) {
                        $ids[] = $uid;
                    }
                } else {
                    throw new PaginationException("Identifiant utilisateur invalide dans « {$key} » : {$clean}.");
                }
            }
        }

        if (!$found || $isAll) {
            return ['mode' => 'none', 'ids' => []];
        }
        return ['mode' => 'filter', 'ids' => $ids];
    }
}
