<?php

declare(strict_types=1);

namespace App\Pagination;

use PDO;
use PDOStatement;

/**
 * Moteur central réutilisable de pagination par curseur (keyset pagination)
 * compatible MySQL & SQLite, tri ascendant/descendant et navigation avant/arrière.
 */
final class CursorPaginator
{
    /**
     * Exécute une requête paginée par curseur.
     *
     * @param callable(array<int, array<string, mixed>>): array<int, array<string, mixed>>|null $hydrator
     */
    public function paginate(
        PDO $db,
        PaginatableQuery $query,
        PageRequest $request,
        ?callable $hydrator = null
    ): PaginatedResult {
        $filter = $query->getFilter();
        $limit = $request->getLimit();
        $sortField = $request->getSortField();
        $sortDir = $request->getSortDirection();
        $backward = $request->isBackward();

        if ($filter->isEmptyResult()) {
            return new PaginatedResult(
                [],
                $limit,
                false,
                false,
                null,
                null,
                $request->shouldIncludeTotal() ? 0 : null
            );
        }

        $cursorToken = $request->getCursor();
        $cursorValues = $cursorToken !== null
            ? CursorCodec::decode($cursorToken, $sortField, $sortDir)
            : null;

        $terms = $sortField->getTerms();
        $effectiveDirs = [];
        $selectParts = [$query->getSelectSql()];
        $orderByParts = [];

        foreach ($terms as $term) {
            $dir = $term->getEffectiveDirection($sortDir, $backward);
            $effectiveDirs[] = $dir;
            $selectParts[] = "{$term->getSqlExpr()} AS `{$term->getCursorAlias()}`";
            $orderByParts[] = "{$term->getSqlExpr()} {$dir}";
        }

        $whereClauses = [$filter->getWhereSql()];
        $bindings = $filter->getBindings();

        if ($cursorValues !== null) {
            [$cursorSql, $cursorBindings] = $this->buildKeysetPredicate($terms, $effectiveDirs, $cursorValues);
            $whereClauses[] = $cursorSql;
            foreach ($cursorBindings as $val) {
                $bindings[] = $val;
            }
        }

        $sql = 'SELECT ' . implode(', ', $selectParts)
            . ' FROM ' . $query->getFromSql()
            . ' WHERE ' . implode(' AND ', $whereClauses)
            . ' ORDER BY ' . implode(', ', $orderByParts)
            . ' LIMIT ?';

        $bindings[] = $limit + 1;

        $stmt = $db->prepare($sql);
        $this->bindParameters($stmt, $bindings);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $hasOverflow = count($rows) > $limit;
        if ($hasOverflow) {
            array_pop($rows);
        }

        if ($backward) {
            $rows = array_reverse($rows);
        }

        $firstTermValues = null;
        $lastTermValues = null;

        if (!empty($rows)) {
            $firstRow = $rows[0];
            $lastRow = $rows[count($rows) - 1];
            $firstTermValues = $this->extractTermValues($firstRow, $terms);
            $lastTermValues = $this->extractTermValues($lastRow, $terms);
        }

        // Nettoyage des colonnes techniques de curseur avant hydratation
        foreach ($rows as &$row) {
            foreach ($terms as $term) {
                unset($row[$term->getCursorAlias()]);
            }
        }
        unset($row);

        $total = null;
        if ($request->shouldIncludeTotal()) {
            $total = $this->executeTotalCount($db, $query);
        }

        if ($hydrator !== null && !empty($rows)) {
            $rows = $hydrator($rows);
        }

        $hasMore = $backward
            ? ($cursorValues !== null && !empty($rows))
            : $hasOverflow;
        $hasPrevious = $backward
            ? $hasOverflow
            : ($cursorValues !== null && !empty($rows));

        $nextCursor = ($hasMore && $lastTermValues !== null)
            ? CursorCodec::encode($sortField->getKey(), $sortDir, $lastTermValues)
            : null;

        $previousCursor = ($hasPrevious && $firstTermValues !== null)
            ? CursorCodec::encode($sortField->getKey(), $sortDir, $firstTermValues)
            : null;

        return new PaginatedResult(
            $rows,
            $limit,
            $hasMore,
            $hasPrevious,
            $nextCursor,
            $previousCursor,
            $total
        );
    }

    /**
     * Construit le prédicat SQL keyset optimisé pour les index (tuple uniforme ou disjonction bornée).
     *
     * @param SortTerm[] $terms
     * @param string[] $effectiveDirs
     * @param array<int, int|float|string> $cursorValues
     * @return array{0: string, 1: array<int, int|float|string>}
     */
    private function buildKeysetPredicate(array $terms, array $effectiveDirs, array $cursorValues): array
    {
        $count = count($terms);
        $firstDir = $effectiveDirs[0];
        $allSameDirection = true;
        for ($i = 1; $i < $count; $i++) {
            if ($effectiveDirs[$i] !== $firstDir) {
                $allSameDirection = false;
                break;
            }
        }

        // Fast-path tuple SQL natif lorsque tous les critères partagent le même sens (MySQL 5.7+ / SQLite 3.15+)
        if ($allSameDirection) {
            $op = $firstDir === 'ASC' ? '>' : '<';
            $exprList = implode(', ', array_map(static fn(SortTerm $t): string => $t->getSqlExpr(), $terms));
            $placeholders = implode(', ', array_fill(0, $count, '?'));
            return ["({$exprList}) {$op} ({$placeholders})", $cursorValues];
        }

        // Chemin mixte : disjonction lexicographique exacte avec borne haute/basse en tête pour favoriser l'index seek
        $orBranches = [];
        $bindings = [];
        $leadingBoundSql = '';

        if (!$terms[0]->isBinaryFlag()) {
            $leadingOp = $effectiveDirs[0] === 'ASC' ? '>=' : '<=';
            $leadingBoundSql = "({$terms[0]->getSqlExpr()} {$leadingOp} ?) AND ";
            $bindings[] = $cursorValues[0];
        }

        for ($i = 0; $i < $count; $i++) {
            $branchParts = [];
            for ($j = 0; $j < $i; $j++) {
                $branchParts[] = "{$terms[$j]->getSqlExpr()} = ?";
                $bindings[] = $cursorValues[$j];
            }
            $op = $effectiveDirs[$i] === 'ASC' ? '>' : '<';
            $branchParts[] = "{$terms[$i]->getSqlExpr()} {$op} ?";
            $bindings[] = $cursorValues[$i];
            $orBranches[] = '(' . implode(' AND ', $branchParts) . ')';
        }

        $sql = '(' . $leadingBoundSql . '(' . implode(' OR ', $orBranches) . '))';
        return [$sql, $bindings];
    }

    /**
     * @param array<string, mixed> $row
     * @param SortTerm[] $terms
     * @return array<int, int|float|string>
     */
    private function extractTermValues(array $row, array $terms): array
    {
        $values = [];
        foreach ($terms as $term) {
            $alias = $term->getCursorAlias();
            $values[] = $term->normalizeValue($row[$alias] ?? null);
        }
        return $values;
    }

    private function executeTotalCount(PDO $db, PaginatableQuery $query): int
    {
        $filter = $query->getFilter();
        if ($filter->isEmptyResult()) {
            return 0;
        }
        $sql = 'SELECT COUNT(*) FROM ' . $query->getCountFromSql() . ' WHERE ' . $filter->getWhereSql();
        $stmt = $db->prepare($sql);
        $this->bindParameters($stmt, $filter->getBindings());
        $stmt->execute();
        return (int)$stmt->fetchColumn();
    }

    /**
     * @param array<int, int|float|string> $bindings
     */
    private function bindParameters(PDOStatement $stmt, array $bindings): void
    {
        foreach ($bindings as $index => $value) {
            $paramType = is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue($index + 1, $value, $paramType);
        }
    }
}
