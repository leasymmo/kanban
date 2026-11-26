<?php

namespace App;

use PDO;

/**
 * Gestion centralisée de la visibilité et des états différentiels des sous-tâches par sprint.
 * Aucune écriture dans subtask_sprint_states n'a lieu pendant la vie normale du sprint actif :
 * les deltas ne sont enregistrés qu'à la clôture (ou lors d'une retouche admin sur un sprint clôturé).
 */
class SubtaskStateHelper {
    /**
     * Retourne une map [sprint_id => sprint_number].
     */
    public static function getSprintNumberMap(PDO $db): array {
        $rows = $db->query("SELECT id, number FROM sprints")->fetchAll(PDO::FETCH_ASSOC);
        $map = [];
        foreach ($rows as $row) {
            $map[(int)$row['id']] = (int)$row['number'];
        }
        return $map;
    }

    /**
     * Retourne les métadonnées minimales d'un sprint ['id', 'number', 'status'].
     */
    public static function getSprintMeta(PDO $db, int $sprintId): ?array {
        $stmt = $db->prepare("SELECT id, number, status FROM sprints WHERE id = ? LIMIT 1");
        $stmt->execute([$sprintId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        return [
            'id' => (int)$row['id'],
            'number' => (int)$row['number'],
            'status' => $row['status']
        ];
    }

    /**
     * Détermine si une sous-tâche existait et n'était pas encore supprimée dans un sprint donné.
     */
    public static function isVisibleInSprint(array $subtask, int $targetSprintNumber, array $sprintNumMap): bool {
        if (!empty($subtask['created_sprint_id'])) {
            $createdId = (int)$subtask['created_sprint_id'];
            if (isset($sprintNumMap[$createdId]) && $sprintNumMap[$createdId] > $targetSprintNumber) {
                return false;
            }
        }

        if (!empty($subtask['deleted_sprint_id'])) {
            $deletedId = (int)$subtask['deleted_sprint_id'];
            if (isset($sprintNumMap[$deletedId]) && $sprintNumMap[$deletedId] <= $targetSprintNumber) {
                return false;
            }
        }

        return true;
    }

    /**
     * Charge le dernier état connu (<= ou < $sprintNumber) dans subtask_sprint_states pour un lot de sous-tâches.
     */
    public static function fetchResolvedStatesBySubtaskIds(
        PDO $db,
        array $subtaskIds,
        int $sprintNumber,
        bool $strictlyBefore = false
    ): array {
        $ids = array_values(array_unique(array_map('intval', $subtaskIds)));
        if (empty($ids)) {
            return [];
        }

        $inClause = implode(',', array_fill(0, count($ids), '?'));
        $op = $strictlyBefore ? '<' : '<=';

        $stmt = $db->prepare("
            SELECT sss.subtask_id, sss.is_done
            FROM subtask_sprint_states sss
            JOIN sprints s ON s.id = sss.sprint_id
            WHERE sss.subtask_id IN ($inClause)
              AND s.number $op ?
            ORDER BY s.number ASC
        ");
        $stmt->execute(array_merge($ids, [$sprintNumber]));

        $resolved = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $resolved[(int)$row['subtask_id']] = (int)$row['is_done'];
        }
        return $resolved;
    }

    /**
     * Retourne les sous-tâches d'un lot de tâches résolues pour un sprint donné (visibilité + is_done).
     * Retourne [task_id => subtask[]].
     */
    public static function fetchResolvedSubtasksForTasks(
        PDO $db,
        array $taskIds,
        int $sprintId,
        ?int $sprintNumber = null,
        ?string $sprintStatus = null
    ): array {
        $ids = array_values(array_unique(array_map('intval', $taskIds)));
        if (empty($ids)) {
            return [];
        }

        if ($sprintNumber === null || $sprintStatus === null) {
            $meta = self::getSprintMeta($db, $sprintId);
            if ($meta) {
                $sprintNumber = $meta['number'];
                $sprintStatus = $meta['status'];
            } else {
                $sprintNumber = PHP_INT_MAX;
                $sprintStatus = 'active';
            }
        }

        $sprintNumMap = self::getSprintNumberMap($db);
        $inClause = implode(',', array_fill(0, count($ids), '?'));

        $stmtSub = $db->prepare("
            SELECT * FROM subtasks
            WHERE task_id IN ($inClause)
            ORDER BY position ASC, id ASC
        ");
        $stmtSub->execute($ids);
        $rawSubtasks = $stmtSub->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rawSubtasks)) {
            return [];
        }

        $isClosed = ($sprintStatus === 'closed');
        $stateMap = [];
        if ($isClosed) {
            $subIds = array_column($rawSubtasks, 'id');
            $stateMap = self::fetchResolvedStatesBySubtaskIds($db, $subIds, $sprintNumber, false);
        }

        $grouped = [];
        foreach ($rawSubtasks as $sub) {
            if (!self::isVisibleInSprint($sub, $sprintNumber, $sprintNumMap)) {
                continue;
            }
            if ($isClosed) {
                $sub['is_done'] = $stateMap[(int)$sub['id']] ?? 0;
            }
            $grouped[(int)$sub['task_id']][] = $sub;
        }

        return $grouped;
    }

    /**
     * Fige uniquement les écarts (deltas) d'état is_done des sous-tâches d'un sprint lors de sa clôture.
     */
    public static function freezeSprintSubtaskDeltas(PDO $db, int $sprintId, ?int $sprintNumber = null): void {
        if ($sprintNumber === null) {
            $meta = self::getSprintMeta($db, $sprintId);
            if (!$meta) {
                return;
            }
            $sprintNumber = $meta['number'];
        }

        $stmtSubs = $db->prepare("
            SELECT DISTINCT sub.id, sub.is_done, sub.created_sprint_id, sub.deleted_sprint_id
            FROM subtasks sub
            JOIN sprint_tasks st ON st.task_id = sub.task_id
            WHERE st.sprint_id = ?
        ");
        $stmtSubs->execute([$sprintId]);
        $allSubs = $stmtSubs->fetchAll(PDO::FETCH_ASSOC);

        if (empty($allSubs)) {
            return;
        }

        $sprintNumMap = self::getSprintNumberMap($db);
        $visibleSubs = [];
        $visibleIds = [];
        foreach ($allSubs as $sub) {
            if (self::isVisibleInSprint($sub, $sprintNumber, $sprintNumMap)) {
                $visibleSubs[] = $sub;
                $visibleIds[] = (int)$sub['id'];
            }
        }

        if (empty($visibleIds)) {
            return;
        }

        $priorStates = self::fetchResolvedStatesBySubtaskIds($db, $visibleIds, $sprintNumber, true);

        $stmtUpsert = $db->prepare("
            INSERT INTO subtask_sprint_states (subtask_id, sprint_id, is_done)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE is_done = VALUES(is_done)
        ");
        $stmtDelete = $db->prepare("
            DELETE FROM subtask_sprint_states
            WHERE subtask_id = ? AND sprint_id = ?
        ");

        foreach ($visibleSubs as $sub) {
            $subId = (int)$sub['id'];
            $liveDone = (int)$sub['is_done'];
            $priorDone = $priorStates[$subId] ?? 0;

            if ($liveDone !== $priorDone) {
                $stmtUpsert->execute([$subId, $sprintId, $liveDone]);
            } else {
                // Nettoie un éventuel ancien delta devenu identique à l'état hérité (ex: après réouverture)
                $stmtDelete->execute([$subId, $sprintId]);
            }
        }
    }

    /**
     * Restaure subtasks.is_done avec l'état résolu du sprint lors de sa réouverture en sprint actif.
     */
    public static function restoreReopenedSprintSubtasks(PDO $db, int $sprintId, ?int $sprintNumber = null): void {
        if ($sprintNumber === null) {
            $meta = self::getSprintMeta($db, $sprintId);
            if (!$meta) {
                return;
            }
            $sprintNumber = $meta['number'];
        }

        $stmtSubs = $db->prepare("
            SELECT DISTINCT sub.id, sub.created_sprint_id, sub.deleted_sprint_id
            FROM subtasks sub
            JOIN sprint_tasks st ON st.task_id = sub.task_id
            WHERE st.sprint_id = ?
        ");
        $stmtSubs->execute([$sprintId]);
        $allSubs = $stmtSubs->fetchAll(PDO::FETCH_ASSOC);

        if (empty($allSubs)) {
            return;
        }

        $sprintNumMap = self::getSprintNumberMap($db);
        $visibleIds = [];
        foreach ($allSubs as $sub) {
            if (self::isVisibleInSprint($sub, $sprintNumber, $sprintNumMap)) {
                $visibleIds[] = (int)$sub['id'];
            }
        }

        if (empty($visibleIds)) {
            return;
        }

        $resolvedStates = self::fetchResolvedStatesBySubtaskIds($db, $visibleIds, $sprintNumber, false);
        $stmtUpdate = $db->prepare("UPDATE subtasks SET is_done = ? WHERE id = ?");
        foreach ($visibleIds as $subId) {
            $stmtUpdate->execute([$resolvedStates[$subId] ?? 0, $subId]);
        }

        // Le sprint étant désormais actif, ses anciens deltas de clôture deviennent inutiles
        $stmtCleanStates = $db->prepare("DELETE FROM subtask_sprint_states WHERE sprint_id = ?");
        $stmtCleanStates->execute([$sprintId]);
    }

    /**
     * Matérialise l'état résolu hérité dans les sprints clôturés ultérieurs avant réouverture
     * ou suppression d'un sprint intermédiaire afin qu'aucune archive postérieure ne dérive.
     */
    public static function materializeDownstreamInheritedStates(PDO $db, int $sprintId, int $sprintNumber): void {
        $stmtNextClosed = $db->prepare("
            SELECT DISTINCT st2.task_id, s2.id AS next_sprint_id, s2.number AS next_sprint_number
            FROM sprint_tasks st1
            JOIN sprint_tasks st2 ON st2.task_id = st1.task_id
            JOIN sprints s2 ON s2.id = st2.sprint_id
            WHERE st1.sprint_id = ?
              AND s2.status = 'closed'
              AND s2.number > ?
            ORDER BY s2.number ASC
        ");
        $stmtNextClosed->execute([$sprintId, $sprintNumber]);
        $downstreamRows = $stmtNextClosed->fetchAll(PDO::FETCH_ASSOC);

        if (empty($downstreamRows)) {
            return;
        }

        // Ne matérialiser que sur le premier sprint clôturé suivant pour chaque tâche
        $firstClosedByTask = [];
        foreach ($downstreamRows as $row) {
            $tid = (int)$row['task_id'];
            if (!isset($firstClosedByTask[$tid])) {
                $firstClosedByTask[$tid] = [
                    'sprint_id' => (int)$row['next_sprint_id'],
                    'number' => (int)$row['next_sprint_number']
                ];
            }
        }

        $taskIds = array_keys($firstClosedByTask);
        $inClause = implode(',', array_fill(0, count($taskIds), '?'));
        $stmtSubs = $db->prepare("SELECT id, task_id, created_sprint_id, deleted_sprint_id FROM subtasks WHERE task_id IN ($inClause)");
        $stmtSubs->execute($taskIds);
        $subs = $stmtSubs->fetchAll(PDO::FETCH_ASSOC);

        if (empty($subs)) {
            return;
        }

        $sprintNumMap = self::getSprintNumberMap($db);
        $stmtInsertIgnore = $db->prepare("
            INSERT IGNORE INTO subtask_sprint_states (subtask_id, sprint_id, is_done)
            VALUES (?, ?, ?)
        ");

        foreach ($subs as $sub) {
            $tid = (int)$sub['task_id'];
            $target = $firstClosedByTask[$tid];
            if (!self::isVisibleInSprint($sub, $target['number'], $sprintNumMap)) {
                continue;
            }
            $subId = (int)$sub['id'];
            $resolved = self::fetchResolvedStatesBySubtaskIds($db, [$subId], $target['number'], false);
            $stmtInsertIgnore->execute([$subId, $target['sprint_id'], $resolved[$subId] ?? 0]);
        }
    }

    /**
     * Réattache created_sprint_id et deleted_sprint_id vers les sprints ultérieurs avant la suppression d'un sprint,
     * et supprime les sous-tâches qui n'existaient que dans ce sprint (et aucun sprint ultérieur).
     */
    public static function reassignSubtaskSprintRefsBeforeDelete(PDO $db, int $deletingSprintId, int $deletingNumber): void {
        // Pour created_sprint_id = sprint supprimé :
        // - si la tâche continue dans un sprint ultérieur (> deletingNumber), réattacher à ce sprint
        // - sinon (ex: suppression du sprint actif le plus récent), supprimer la sous-tâche créée uniquement dans ce sprint
        $stmtCreated = $db->prepare("SELECT id, task_id FROM subtasks WHERE created_sprint_id = ? ORDER BY parent_id IS NULL ASC, id DESC");
        $stmtCreated->execute([$deletingSprintId]);
        $stmtFindNextCreated = $db->prepare("
            SELECT s.id
            FROM sprint_tasks st
            JOIN sprints s ON s.id = st.sprint_id
            WHERE st.task_id = ? AND s.id != ? AND s.number > ?
            ORDER BY s.number ASC, st.id ASC
            LIMIT 1
        ");
        $stmtUpdateCreated = $db->prepare("UPDATE subtasks SET created_sprint_id = ? WHERE id = ?");
        $stmtDeleteCreated = $db->prepare("DELETE FROM subtasks WHERE id = ?");
        foreach ($stmtCreated->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $stmtFindNextCreated->execute([(int)$row['task_id'], $deletingSprintId, $deletingNumber]);
            $nextId = $stmtFindNextCreated->fetchColumn();
            if ($nextId) {
                $stmtUpdateCreated->execute([(int)$nextId, (int)$row['id']]);
            } else {
                // Supprime la sous-tâche (ON DELETE CASCADE nettoie aussi ses enfants et subtask_sprint_states)
                $stmtDeleteCreated->execute([(int)$row['id']]);
            }
        }

        $stmtDeleted = $db->prepare("SELECT id, task_id FROM subtasks WHERE deleted_sprint_id = ?");
        $stmtDeleted->execute([$deletingSprintId]);
        $stmtFindNextDeleted = $db->prepare("
            SELECT s.id
            FROM sprint_tasks st
            JOIN sprints s ON s.id = st.sprint_id
            WHERE st.task_id = ? AND s.id != ? AND s.number > ?
            ORDER BY s.number ASC, st.id ASC
            LIMIT 1
        ");
        $stmtUpdateDeleted = $db->prepare("UPDATE subtasks SET deleted_sprint_id = ? WHERE id = ?");
        foreach ($stmtDeleted->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $stmtFindNextDeleted->execute([(int)$row['task_id'], $deletingSprintId, $deletingNumber]);
            $nextId = $stmtFindNextDeleted->fetchColumn();
            $stmtUpdateDeleted->execute([$nextId ? (int)$nextId : null, (int)$row['id']]);
        }
    }

    /**
     * Enregistre un changement explicite d'état sur un sprint clôturé (action admin sur archive).
     */
    public static function setClosedSprintSubtaskDelta(
        PDO $db,
        int $subtaskId,
        int $sprintId,
        int $sprintNumber,
        int $newIsDone
    ): void {
        $priorStates = self::fetchResolvedStatesBySubtaskIds($db, [$subtaskId], $sprintNumber, true);
        $priorDone = $priorStates[$subtaskId] ?? 0;

        if ($newIsDone !== $priorDone) {
            $stmt = $db->prepare("
                INSERT INTO subtask_sprint_states (subtask_id, sprint_id, is_done)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE is_done = VALUES(is_done)
            ");
            $stmt->execute([$subtaskId, $sprintId, $newIsDone]);
        } else {
            $stmt = $db->prepare("DELETE FROM subtask_sprint_states WHERE subtask_id = ? AND sprint_id = ?");
            $stmt->execute([$subtaskId, $sprintId]);
        }
    }

    /**
     * Supprime physiquement les sous-tâches créées dans le sprint cible,
     * et marque deleted_sprint_id pour celles créées dans un sprint antérieur afin de préserver les archives.
     */
    public static function deleteSubtreeInSprint(PDO $db, int $taskId, int $rootSubtaskId, ?int $sprintId): void {
        $stmtAll = $db->prepare("SELECT id, parent_id, created_sprint_id, deleted_sprint_id FROM subtasks WHERE task_id = ?");
        $stmtAll->execute([$taskId]);
        $rows = $stmtAll->fetchAll(PDO::FETCH_ASSOC);

        $byId = [];
        $childrenMap = [];
        foreach ($rows as $row) {
            $sid = (int)$row['id'];
            $byId[$sid] = $row;
            $pid = $row['parent_id'] !== null ? (int)$row['parent_id'] : 0;
            $childrenMap[$pid][] = $sid;
        }

        if (!isset($byId[$rootSubtaskId])) {
            return;
        }

        // Parcours en post-ordre pour supprimer les enfants avant les parents si suppression physique
        $orderedIds = [];
        $stack = [$rootSubtaskId];
        $visited = [];
        while (!empty($stack)) {
            $curr = array_pop($stack);
            if (isset($visited[$curr])) {
                continue;
            }
            $visited[$curr] = true;
            $orderedIds[] = $curr;
            foreach ($childrenMap[$curr] ?? [] as $childId) {
                $stack[] = $childId;
            }
        }
        $postOrderIds = array_reverse($orderedIds);

        $stmtHardDel = $db->prepare("DELETE FROM subtasks WHERE id = ?");
        $stmtSoftDel = $db->prepare("UPDATE subtasks SET deleted_sprint_id = ? WHERE id = ? AND deleted_sprint_id IS NULL");

        foreach ($postOrderIds as $sid) {
            $sub = $byId[$sid];
            $createdSprintId = $sub['created_sprint_id'] !== null ? (int)$sub['created_sprint_id'] : null;

            if ($sprintId === null || ($createdSprintId !== null && $createdSprintId === $sprintId)) {
                $stmtHardDel->execute([$sid]);
            } else {
                $stmtSoftDel->execute([$sprintId, $sid]);
            }
        }
    }
}
