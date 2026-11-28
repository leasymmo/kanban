<?php

declare(strict_types=1);

namespace App\Pagination\Specs;

use App\Pagination\PaginatableQuery;
use App\Pagination\PaginationException;
use App\Pagination\QueryFilter;
use App\Pagination\SortField;
use App\Pagination\SortSpec;
use App\Pagination\SortTerm;
use App\SubtaskStateHelper;
use PDO;

/**
 * Spécification centralisée des filtres, tris, groupes, compteurs et hydratation des tâches.
 */
final class TaskQuerySpec
{
    public const VALID_STATUSES = ['pending', 'todo', 'in_progress', 'blocked', 'done'];
    public const BOARD_STATUSES = ['todo', 'in_progress', 'blocked', 'done'];
    public const VALID_PRIORITIES = ['low', 'medium', 'high'];
    public const VALID_DUE_STATES = ['all', 'overdue', 'with_date', 'without_date'];

    public static function buildSortSpec(PDO $db, string $sprintStatus = 'active'): SortSpec
    {
        $isSqlite = ((string)$db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite');
        $titleExpr = $isSqlite ? 't.title COLLATE NOCASE' : 't.title';
        $propNameExpr = $isSqlite ? "COALESCE(p.name, '') COLLATE NOCASE" : "COALESCE(p.name, '')";
        $assigneeNameExpr = $isSqlite ? "COALESCE(ua.name, '') COLLATE NOCASE" : "COALESCE(ua.name, '')";
        $castIntType = $isSqlite ? 'INTEGER' : 'SIGNED';
        $subPctExpr = "CAST(ROUND(CASE WHEN COALESCE(sub_agg.sub_total, 0) > 0 THEN (sub_agg.sub_done * 100.0) / sub_agg.sub_total ELSE 0 END) AS {$castIntType})";

        $fields = [
            new SortField('position', [
                new SortTerm('st.position', '__sort_pos', SortTerm::TYPE_INT, true),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, true),
            ], 'asc'),

            new SortField('priority', [
                new SortTerm("CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END", '__sort_prio', SortTerm::TYPE_INT, true),
                new SortTerm('st.position', '__sort_pos', SortTerm::TYPE_INT, false, 'ASC'),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, false, 'ASC'),
            ], 'asc'),

            new SortField('status', [
                new SortTerm("CASE st.status WHEN 'blocked' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'todo' THEN 2 WHEN 'done' THEN 3 ELSE 4 END", '__sort_status', SortTerm::TYPE_INT, true),
                new SortTerm('st.position', '__sort_pos', SortTerm::TYPE_INT, false, 'ASC'),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, false, 'ASC'),
            ], 'asc'),

            new SortField('due_date', [
                new SortTerm('CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END', '__sort_due_null', SortTerm::TYPE_INT, false, 'ASC', true),
                new SortTerm("COALESCE(t.due_date, '9999-12-31')", '__sort_due_val', SortTerm::TYPE_STRING, true),
                new SortTerm('st.position', '__sort_pos', SortTerm::TYPE_INT, false, 'ASC'),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, false, 'ASC'),
            ], 'asc'),

            new SortField('created_at', [
                new SortTerm("COALESCE(t.created_at, '1970-01-01 00:00:00')", '__sort_created', SortTerm::TYPE_STRING, true),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, true),
            ], 'desc'),

            new SortField('updated_at', [
                new SortTerm("COALESCE(t.updated_at, '1970-01-01 00:00:00')", '__sort_updated', SortTerm::TYPE_STRING, true),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, true),
            ], 'desc'),

            new SortField('alpha', [
                new SortTerm($titleExpr, '__sort_title', SortTerm::TYPE_STRING, true),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, true),
            ], 'asc'),

            new SortField('property', [
                new SortTerm('CASE WHEN p.id IS NULL THEN 1 ELSE 0 END', '__sort_prop_null', SortTerm::TYPE_INT, false, 'ASC', true),
                new SortTerm($propNameExpr, '__sort_prop_name', SortTerm::TYPE_STRING, true),
                new SortTerm('st.position', '__sort_pos', SortTerm::TYPE_INT, false, 'ASC'),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, false, 'ASC'),
            ], 'asc'),

            new SortField('assignee', [
                new SortTerm('CASE WHEN ua.id IS NULL THEN 1 ELSE 0 END', '__sort_ass_null', SortTerm::TYPE_INT, false, 'ASC', true),
                new SortTerm($assigneeNameExpr, '__sort_ass_name', SortTerm::TYPE_STRING, true),
                new SortTerm('st.position', '__sort_pos', SortTerm::TYPE_INT, false, 'ASC'),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, false, 'ASC'),
            ], 'asc'),

            new SortField('subtasks', [
                new SortTerm('CASE WHEN COALESCE(sub_agg.sub_total, 0) = 0 THEN 1 ELSE 0 END', '__sort_sub_null', SortTerm::TYPE_INT, false, 'ASC', true),
                new SortTerm($subPctExpr, '__sort_sub_pct', SortTerm::TYPE_INT, true),
                new SortTerm('COALESCE(sub_agg.sub_total, 0)', '__sort_sub_total', SortTerm::TYPE_INT, true),
                new SortTerm('st.position', '__sort_pos', SortTerm::TYPE_INT, false, 'ASC'),
                new SortTerm('t.id', '__sort_id', SortTerm::TYPE_INT, false, 'ASC'),
            ], 'asc'),
        ];

        unset($sprintStatus);

        return new SortSpec($fields, 'position', [
            'title' => 'alpha',
            'manual' => 'position',
        ]);
    }

    /**
     * Construit le QueryFilter SQL complet à partir des paramètres de requête.
     *
     * @param array<string, mixed> $params
     * @param array<string, mixed> $currentUser
     */
    public static function buildFilter(
        PDO $db,
        array $params,
        array $currentUser,
        int $sprintId,
        int $sprintNumber,
        bool $omitStatus = false,
        bool $omitAssignee = false,
        bool $omitProperty = false
    ): QueryFilter {
        $filter = new QueryFilter();
        $filter->addRawClause('st.sprint_id = ?', [$sprintId]);

        $scope = isset($params['scope']) && is_string($params['scope']) ? strtolower(trim($params['scope'])) : 'all';
        if (!in_array($scope, ['all', 'board', 'meeting'], true)) {
            throw new PaginationException("Paramètre « scope » invalide : {$scope}.");
        }

        // Le tableau Kanban/Propriétés/Liste exclut toujours les tâches 'pending' ou sans responsable (App.tsx L560)
        $isBoardScope = ($scope === 'board');

        // 1. Statuts
        if (!$omitStatus) {
            $statuses = QueryFilter::parseStringList(
                $params,
                ['status', 'statuses'],
                self::VALID_STATUSES
            );
            $excludeStatuses = QueryFilter::parseStringList(
                $params,
                ['exclude_status', 'exclude_statuses'],
                self::VALID_STATUSES
            );

            if ($statuses !== null) {
                if ($isBoardScope) {
                    $statuses = array_values(array_diff($statuses, ['pending']));
                }
                if ($excludeStatuses !== null) {
                    $statuses = array_values(array_diff($statuses, $excludeStatuses));
                }
                $filter->whereStringIn('st.status', $statuses);
            } else {
                $includePending = QueryFilter::parseOptionalBool($params, 'include_pending');
                if ($isBoardScope || $includePending === 0 || ($includePending === null && $scope !== 'meeting')) {
                    $filter->addRawClause("st.status != 'pending'");
                }
                if ($excludeStatuses !== null && !empty($excludeStatuses)) {
                    $placeholders = implode(',', array_fill(0, count($excludeStatuses), '?'));
                    $filter->addRawClause("st.status NOT IN ({$placeholders})", $excludeStatuses);
                }
            }
        } elseif ($isBoardScope) {
            $filter->addRawClause("st.status != 'pending'");
        }

        // 2. Responsable(s)
        $assignedOnly = QueryFilter::parseOptionalBool($params, 'assigned_only') === 1 || $isBoardScope;
        if ($assignedOnly) {
            $filter->addRawClause('st.assigned_to IS NOT NULL');
        }

        if (!$omitAssignee) {
            $assigneeParsed = self::parseAssigneeParam($params, (int)($currentUser['id'] ?? 0));
            if ($assigneeParsed['mode'] === 'filter') {
                if ($assignedOnly) {
                    $filter->whereIntInOrNull('st.assigned_to', $assigneeParsed['ids'], false);
                } else {
                    $filter->whereIntInOrNull('st.assigned_to', $assigneeParsed['ids'], $assigneeParsed['include_null']);
                }
            } elseif ($assigneeParsed['mode'] === 'unassigned') {
                if ($assignedOnly) {
                    $filter->markEmpty();
                } else {
                    $filter->addRawClause('st.assigned_to IS NULL');
                }
            }
        }

        // 3. Logement(s)
        if (!$omitProperty) {
            $propParsed = self::parsePropertyParam($params);
            if ($propParsed !== null) {
                $filter->whereIntInOrNull('t.property_id', $propParsed['ids'], $propParsed['include_null']);
            }
            $excludePropParsed = self::parsePropertyParam($params, ['exclude_property_id', 'exclude_property_ids']);
            if ($excludePropParsed !== null) {
                if ($excludePropParsed['include_null']) {
                    $filter->addRawClause('t.property_id IS NOT NULL');
                }
                if (!empty($excludePropParsed['ids'])) {
                    $placeholders = implode(',', array_fill(0, count($excludePropParsed['ids']), '?'));
                    $filter->addRawClause("(t.property_id IS NULL OR t.property_id NOT IN ({$placeholders}))", $excludePropParsed['ids']);
                }
            }
        }

        // 4. Priorité(s)
        $priorities = QueryFilter::parseStringList($params, ['priority', 'priorities'], self::VALID_PRIORITIES);
        $excludePriorities = QueryFilter::parseStringList($params, ['exclude_priority', 'exclude_priorities'], self::VALID_PRIORITIES);
        if ($priorities !== null) {
            if ($excludePriorities !== null) {
                $priorities = array_values(array_diff($priorities, $excludePriorities));
            }
            $filter->whereStringIn('t.priority', $priorities);
        } elseif ($excludePriorities !== null && !empty($excludePriorities)) {
            $placeholders = implode(',', array_fill(0, count($excludePriorities), '?'));
            $filter->addRawClause("t.priority NOT IN ({$placeholders})", $excludePriorities);
        }

        // 5. Échéances & dates
        $dueFrom = QueryFilter::parseOptionalDate($params, 'due_date_from');
        if ($dueFrom !== null) {
            $filter->addRawClause('t.due_date >= ?', [$dueFrom]);
        }
        $dueTo = QueryFilter::parseOptionalDate($params, 'due_date_to');
        if ($dueTo !== null) {
            $filter->addRawClause('t.due_date <= ?', [$dueTo]);
        }

        $dueState = isset($params['due_state']) && is_string($params['due_state'])
            ? strtolower(trim($params['due_state']))
            : 'all';
        if ($dueState !== '' && $dueState !== 'all') {
            if (!in_array($dueState, self::VALID_DUE_STATES, true)) {
                throw new PaginationException("Filtre « due_state » invalide : {$dueState}.");
            }
            $todayExpr = ((string)$db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite')
                ? "date('now')"
                : 'CURDATE()';
            if ($dueState === 'overdue') {
                $filter->addRawClause("t.due_date IS NOT NULL AND t.due_date < {$todayExpr} AND st.status != 'done'");
            } elseif ($dueState === 'with_date') {
                $filter->addRawClause('t.due_date IS NOT NULL');
            } elseif ($dueState === 'without_date') {
                $filter->addRawClause('t.due_date IS NULL');
            }
        }

        $createdFrom = QueryFilter::parseOptionalDate($params, 'created_from');
        if ($createdFrom !== null) {
            $filter->addRawClause('t.created_at >= ?', [$createdFrom . ' 00:00:00']);
        }
        $createdTo = QueryFilter::parseOptionalDate($params, 'created_to');
        if ($createdTo !== null) {
            $filter->addRawClause('t.created_at <= ?', [$createdTo . ' 23:59:59']);
        }

        $updatedFrom = QueryFilter::parseOptionalDate($params, 'updated_from');
        if ($updatedFrom !== null) {
            $filter->addRawClause('t.updated_at >= ?', [$updatedFrom . ' 00:00:00']);
        }
        $updatedTo = QueryFilter::parseOptionalDate($params, 'updated_to');
        if ($updatedTo !== null) {
            $filter->addRawClause('t.updated_at <= ?', [$updatedTo . ' 23:59:59']);
        }

        // 6. Drapeaux sprint
        $isStarred = QueryFilter::parseOptionalBool($params, 'is_starred');
        if ($isStarred !== null) {
            $filter->addRawClause('st.is_starred = ?', [$isStarred]);
        }
        $isUnplanned = QueryFilter::parseOptionalBool($params, 'is_unplanned');
        if ($isUnplanned !== null) {
            $filter->addRawClause('st.is_unplanned = ?', [$isUnplanned]);
        }
        $isNew = QueryFilter::parseOptionalBool($params, 'is_new');
        if ($isNew !== null) {
            $filter->addRawClause('st.is_new = ?', [$isNew]);
        }

        // 7. Recherche textuelle (titre, description, logement, sous-tâches visibles)
        if (isset($params['search'])) {
            if (is_array($params['search'])) {
                throw new PaginationException('Paramètre « search » invalide.');
            }
            $search = trim((string)$params['search']);
            if ($search !== '') {
                $like = QueryFilter::escapeLike($search);
                $driver = (string)$db->getAttribute(PDO::ATTR_DRIVER_NAME);
                $subSearchExpr = $driver === 'sqlite' ? 'sub_s.title LIKE ? ESCAPE \'!\'' : 'sub_s.title LIKE ? ESCAPE \'!\'';

                if ($sprintNumber > 0) {
                    $subExistsSql = "EXISTS (
                        SELECT 1 FROM subtasks sub_s
                        WHERE sub_s.task_id = t.id
                          AND {$subSearchExpr}
                          AND (sub_s.created_sprint_id IS NULL OR NOT EXISTS (
                              SELECT 1 FROM sprints sc WHERE sc.id = sub_s.created_sprint_id AND sc.number > ?
                          ))
                          AND (sub_s.deleted_sprint_id IS NULL OR NOT EXISTS (
                              SELECT 1 FROM sprints sd WHERE sd.id = sub_s.deleted_sprint_id AND sd.number <= ?
                          ))
                    )";
                    $subBindings = [$like, $sprintNumber, $sprintNumber];
                } else {
                    $subExistsSql = "EXISTS (
                        SELECT 1 FROM subtasks sub_s
                        WHERE sub_s.task_id = t.id AND {$subSearchExpr}
                    )";
                    $subBindings = [$like];
                }

                $filter->addRawClause(
                    "(t.title LIKE ? ESCAPE '!' OR COALESCE(t.description, '') LIKE ? ESCAPE '!' OR COALESCE(p.name, '') LIKE ? ESCAPE '!' OR COALESCE(p.code, '') LIKE ? ESCAPE '!' OR {$subExistsSql})",
                    array_merge([$like, $like, $like, $like], $subBindings)
                );
            }
        }

        return $filter;
    }

    public static function buildQuery(
        PDO $db,
        QueryFilter $filter,
        string $sortBy,
        int $sprintNumber,
        string $sprintStatus
    ): PaginatableQuery {
        $select = "
            t.id, t.title, t.description, t.created_by,
            t.property_id, t.priority, t.due_date,
            t.created_at, t.updated_at,
            st.sprint_id, st.status, st.assigned_to, st.position,
            st.is_unplanned, st.is_starred, st.is_new,
            p.name AS property_name, p.color AS property_color, p.code AS property_code,
            ua.name AS assigned_to_name, ua.initials AS assigned_to_initials, ua.avatar_color AS assigned_to_color,
            COALESCE(uc.name, 'Ancien associé') AS created_by_name,
            COALESCE(uc.initials, '?') AS created_by_initials
        ";

        $subtaskJoin = '';
        if ($sortBy === 'subtasks') {
            if ($sprintStatus === 'closed' && $sprintNumber > 0) {
                $subDoneSql = "COALESCE((
                    SELECT sss.is_done
                    FROM subtask_sprint_states sss
                    JOIN sprints ss ON ss.id = sss.sprint_id
                    WHERE sss.subtask_id = s_item.id AND ss.number <= " . (int)$sprintNumber . "
                    ORDER BY ss.number DESC
                    LIMIT 1
                ), 0)";
            } else {
                $subDoneSql = 's_item.is_done';
            }

            $visibilitySql = $sprintNumber > 0
                ? "AND (s_item.created_sprint_id IS NULL OR NOT EXISTS (SELECT 1 FROM sprints sc WHERE sc.id = s_item.created_sprint_id AND sc.number > " . (int)$sprintNumber . "))
                   AND (s_item.deleted_sprint_id IS NULL OR NOT EXISTS (SELECT 1 FROM sprints sd WHERE sd.id = s_item.deleted_sprint_id AND sd.number <= " . (int)$sprintNumber . "))"
                : '';

            $subtaskJoin = "
                LEFT JOIN (
                    SELECT s_item.task_id,
                           COUNT(*) AS sub_total,
                           SUM(CASE WHEN ({$subDoneSql}) = 1 THEN 1 ELSE 0 END) AS sub_done
                    FROM subtasks s_item
                    WHERE 1 = 1 {$visibilitySql}
                    GROUP BY s_item.task_id
                ) sub_agg ON sub_agg.task_id = t.id
            ";
        }

        $from = "
            sprint_tasks st
            JOIN tasks t ON t.id = st.task_id
            LEFT JOIN properties p ON p.id = t.property_id
            LEFT JOIN users ua ON ua.id = st.assigned_to
            LEFT JOIN users uc ON uc.id = t.created_by
            {$subtaskJoin}
        ";

        $countFrom = "
            sprint_tasks st
            JOIN tasks t ON t.id = st.task_id
            LEFT JOIN properties p ON p.id = t.property_id
        ";

        return new PaginatableQuery($select, $from, $filter, $countFrom);
    }

    /**
     * Hydrate un lot de lignes SQL en objets Task prêts pour l'API (avec résolution batch des sous-tâches).
     *
     * @param array<int, array<string, mixed>> $rows
     * @param array<string, mixed> $currentUser
     * @return array<int, array<string, mixed>>
     */
    public static function hydrateTaskRows(
        PDO $db,
        array $rows,
        int $sprintId,
        int $sprintNumber,
        string $sprintStatus,
        array $currentUser
    ): array {
        if (empty($rows)) {
            return [];
        }

        $taskIds = array_values(array_unique(array_map(static fn(array $r): int => (int)$r['id'], $rows)));
        $subtasksMap = SubtaskStateHelper::fetchResolvedSubtasksForTasks(
            $db,
            $taskIds,
            $sprintId,
            $sprintNumber > 0 ? $sprintNumber : null,
            $sprintStatus
        );

        $isSprintClosed = ($sprintStatus === 'closed');
        $isAdmin = (($currentUser['role'] ?? '') === 'admin');
        $isWrite = (($currentUser['role'] ?? '') === 'write');
        $currentUserId = (int)($currentUser['id'] ?? 0);

        foreach ($rows as &$task) {
            $taskId = (int)$task['id'];
            $assignedTo = $task['assigned_to'] !== null ? (int)$task['assigned_to'] : null;
            $createdBy = (int)$task['created_by'];

            $task['id'] = $taskId;
            $task['sprint_id'] = (int)$task['sprint_id'];
            $task['assigned_to'] = $assignedTo;
            $task['created_by'] = $createdBy;
            $task['property_id'] = $task['property_id'] !== null ? (int)$task['property_id'] : null;
            $task['position'] = (int)$task['position'];
            $task['is_unplanned'] = (int)$task['is_unplanned'];
            $task['is_starred'] = (int)$task['is_starred'];
            $task['is_new'] = (int)$task['is_new'];
            $task['subtasks'] = $subtasksMap[$taskId] ?? [];

            $isOwner = ($assignedTo !== null && $assignedTo === $currentUserId)
                || ($assignedTo === null && $createdBy === $currentUserId);
            $canModify = $isAdmin || (!$isSprintClosed && $isWrite && $isOwner);

            $task['can_edit'] = $canModify;
            $task['can_delete'] = $canModify;
            $task['can_assign'] = $isAdmin;
            $task['can_star'] = $canModify && ($task['status'] !== 'pending');
        }
        unset($task);

        return $rows;
    }

    /**
     * Hydrate rapidement un ensemble ciblé de tâches par IDs (après mutation create/update/addSubtask).
     *
     * @param int[] $taskIds
     * @param array<string, mixed> $currentUser
     * @return array<int, array<string, mixed>>
     */
    public static function hydrateTasksByIds(
        PDO $db,
        array $taskIds,
        int $sprintId,
        int $sprintNumber,
        string $sprintStatus,
        array $currentUser
    ): array {
        $ids = array_values(array_unique(array_filter(array_map('intval', $taskIds), static fn(int $v): bool => $v > 0)));
        if (empty($ids)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $db->prepare("
            SELECT t.id, t.title, t.description, t.created_by,
                   t.property_id, t.priority, t.due_date,
                   t.created_at, t.updated_at,
                   st.sprint_id, st.status, st.assigned_to, st.position,
                   st.is_unplanned, st.is_starred, st.is_new,
                   p.name AS property_name, p.color AS property_color, p.code AS property_code,
                   ua.name AS assigned_to_name, ua.initials AS assigned_to_initials, ua.avatar_color AS assigned_to_color,
                   COALESCE(uc.name, 'Ancien associé') AS created_by_name,
                   COALESCE(uc.initials, '?') AS created_by_initials
            FROM sprint_tasks st
            JOIN tasks t ON t.id = st.task_id
            LEFT JOIN properties p ON p.id = t.property_id
            LEFT JOIN users ua ON ua.id = st.assigned_to
            LEFT JOIN users uc ON uc.id = t.created_by
            WHERE st.sprint_id = ? AND t.id IN ({$placeholders})
            ORDER BY st.position ASC, t.id ASC
        ");
        $stmt->execute(array_merge([$sprintId], $ids));
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return self::hydrateTaskRows($db, $rows, $sprintId, $sprintNumber, $sprintStatus, $currentUser);
    }

    /**
     * Calcule en 2 agrégations SQL légères les compteurs réels par colonne (statut/logement)
     * et par associé, indépendamment de la pagination active.
     *
     * @param array<string, mixed> $params
     * @param array<string, mixed> $currentUser
     * @return array{
     *   status_counts: array<string, int>,
     *   property_counts: array<string, array{total: int, done: int}>,
     *   assignee_counts: array{all: int, unassigned: int, by_user: array<string, int>},
     *   total_matching: int
     * }
     */
    public static function computeFacets(
        PDO $db,
        array $params,
        array $currentUser,
        int $sprintId,
        int $sprintNumber
    ): array {
        // 1. Compteurs par statut & par logement pour le scope + filtres courants
        $currentFilter = self::buildFilter($db, $params, $currentUser, $sprintId, $sprintNumber);
        $baseFrom = 'sprint_tasks st JOIN tasks t ON t.id = st.task_id LEFT JOIN properties p ON p.id = t.property_id';

        $statusCounts = [
            'todo' => 0,
            'in_progress' => 0,
            'blocked' => 0,
            'done' => 0,
            'pending' => 0,
        ];
        $propertyCounts = [];
        $totalMatching = 0;

        if (!$currentFilter->isEmptyResult()) {
            $sqlGroup = "
                SELECT st.status,
                       COALESCE(t.property_id, 0) AS prop_key,
                       COUNT(*) AS cnt
                FROM {$baseFrom}
                WHERE {$currentFilter->getWhereSql()}
                GROUP BY st.status, prop_key
            ";
            $stmtGroup = $db->prepare($sqlGroup);
            self::bindArray($stmtGroup, $currentFilter->getBindings());
            $stmtGroup->execute();

            while ($row = $stmtGroup->fetch(PDO::FETCH_ASSOC)) {
                $cnt = (int)$row['cnt'];
                $st = (string)$row['status'];
                $propKey = (string)((int)$row['prop_key']);
                $totalMatching += $cnt;

                if (isset($statusCounts[$st])) {
                    $statusCounts[$st] += $cnt;
                }
                if (!isset($propertyCounts[$propKey])) {
                    $propertyCounts[$propKey] = ['total' => 0, 'done' => 0];
                }
                $propertyCounts[$propKey]['total'] += $cnt;
                if ($st === 'done') {
                    $propertyCounts[$propKey]['done'] += $cnt;
                }
            }
        }

        // 2. Compteurs par responsable hors filtre assignee (aligné sur facetFilteredTasks de TasksToolbar)
        $facetAssigneeFilter = self::buildFilter($db, $params, $currentUser, $sprintId, $sprintNumber, false, true, false);
        $assigneeAll = 0;
        $assigneeUnassigned = 0;
        $byUser = [];

        if (!$facetAssigneeFilter->isEmptyResult()) {
            $sqlAss = "
                SELECT st.assigned_to, COUNT(*) AS cnt
                FROM {$baseFrom}
                WHERE {$facetAssigneeFilter->getWhereSql()}
                GROUP BY st.assigned_to
            ";
            $stmtAss = $db->prepare($sqlAss);
            self::bindArray($stmtAss, $facetAssigneeFilter->getBindings());
            $stmtAss->execute();

            while ($row = $stmtAss->fetch(PDO::FETCH_ASSOC)) {
                $cnt = (int)$row['cnt'];
                $assigneeAll += $cnt;
                if ($row['assigned_to'] === null) {
                    $assigneeUnassigned += $cnt;
                } else {
                    $uidKey = (string)((int)$row['assigned_to']);
                    $byUser[$uidKey] = ($byUser[$uidKey] ?? 0) + $cnt;
                }
            }
        }

        return [
            'status_counts' => $statusCounts,
            'property_counts' => $propertyCounts,
            'assignee_counts' => [
                'all' => $assigneeAll,
                'unassigned' => $assigneeUnassigned,
                'by_user' => $byUser,
            ],
            'total_matching' => $totalMatching,
        ];
    }

    /**
     * Analyse les paramètres assignee_id / assignee_ids / assigned_to / assignee.
     *
     * @param array<string, mixed> $params
     * @return array{mode: 'none'|'filter'|'unassigned', ids: int[], include_null: bool}
     */
    private static function parseAssigneeParam(array $params, int $currentUserId): array
    {
        $keys = ['assignee_id', 'assignee_ids', 'assigned_to', 'assignee'];
        $found = false;
        $ids = [];
        $includeNull = false;
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
                } elseif ($clean === 'unassigned' || $clean === 'none' || $clean === '0') {
                    $includeNull = true;
                } elseif (ctype_digit($clean) && (int)$clean > 0) {
                    $uid = (int)$clean;
                    if (!in_array($uid, $ids, true)) {
                        $ids[] = $uid;
                    }
                } else {
                    throw new PaginationException("Valeur invalide pour « {$key} » : {$clean}.");
                }
            }
        }

        if (!$found || $isAll) {
            return ['mode' => 'none', 'ids' => [], 'include_null' => false];
        }
        if (empty($ids) && $includeNull) {
            return ['mode' => 'unassigned', 'ids' => [], 'include_null' => true];
        }
        return ['mode' => 'filter', 'ids' => $ids, 'include_null' => $includeNull];
    }

    /**
     * Analyse property_id / property_ids (0 ou 'none' représente Sans logement = NULL).
     *
     * @param array<string, mixed> $params
     * @param string[] $keys
     * @return array{ids: int[], include_null: bool}|null
     */
    public static function parsePropertyParam(array $params, array $keys = ['property_id', 'property_ids']): ?array
    {
        $found = false;
        $ids = [];
        $includeNull = false;

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
                if ($clean === 'none' || $clean === 'null' || $clean === '0') {
                    $includeNull = true;
                } elseif (ctype_digit($clean) && (int)$clean > 0) {
                    $pid = (int)$clean;
                    if (!in_array($pid, $ids, true)) {
                        $ids[] = $pid;
                    }
                } else {
                    throw new PaginationException("Identifiant de logement invalide dans « {$key} » : {$clean}.");
                }
            }
        }

        if (!$found) {
            return null;
        }
        return ['ids' => $ids, 'include_null' => $includeNull];
    }

    /**
     * @param array<int, int|float|string> $bindings
     */
    private static function bindArray(\PDOStatement $stmt, array $bindings): void
    {
        foreach ($bindings as $index => $value) {
            $stmt->bindValue($index + 1, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
    }
}
