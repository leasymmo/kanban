<?php

declare(strict_types=1);

namespace App\Pagination;

/**
 * Requête de pagination normalisée et strictement validée.
 */
final class PageRequest
{
    public const DEFAULT_LIMIT = 30;
    public const MAX_LIMIT = 100;

    private int $limit;
    private SortField $sortField;
    private string $sortDirection;
    private ?string $cursor;
    private bool $backward;
    private bool $includeTotal;

    private function __construct(
        int $limit,
        SortField $sortField,
        string $sortDirection,
        ?string $cursor,
        bool $backward,
        bool $includeTotal
    ) {
        $this->limit = $limit;
        $this->sortField = $sortField;
        $this->sortDirection = $sortDirection;
        $this->cursor = $cursor;
        $this->backward = $backward;
        $this->includeTotal = $includeTotal;
    }

    /**
     * Construit un PageRequest depuis un tableau de paramètres HTTP ($_GET ou équivalent).
     *
     * @param array<string, mixed> $params
     */
    public static function fromArray(
        array $params,
        SortSpec $sortSpec,
        int $defaultLimit = self::DEFAULT_LIMIT,
        int $maxLimit = self::MAX_LIMIT,
        string $prefix = ''
    ): self {
        $limitKey = $prefix . 'limit';
        $sortByKey = $prefix . 'sort_by';
        $sortDirKey = $prefix . 'sort_direction';
        $sortDirAliasKey = $prefix . 'sort_dir';
        $cursorKey = $prefix . 'cursor';
        $afterKey = $prefix . 'after';
        $beforeKey = $prefix . 'before';
        $totalKey = $prefix . 'include_total';

        $limit = $defaultLimit;
        if (isset($params[$limitKey]) && $params[$limitKey] !== '') {
            $rawLimit = $params[$limitKey];
            if (is_array($rawLimit) || !preg_match('/^\d+$/', trim((string)$rawLimit))) {
                throw new PaginationException("Le paramètre « {$limitKey} » doit être un entier positif.");
            }
            $parsed = (int)$rawLimit;
            if ($parsed < 1) {
                throw new PaginationException("Le paramètre « {$limitKey} » doit être supérieur ou égal à 1.");
            }
            $limit = min($parsed, $maxLimit);
        }

        $rawSortBy = null;
        if (isset($params[$sortByKey]) && $params[$sortByKey] !== '') {
            if (is_array($params[$sortByKey])) {
                throw new PaginationException("Le paramètre « {$sortByKey} » est invalide.");
            }
            $rawSortBy = (string)$params[$sortByKey];
        }
        $sortField = $sortSpec->resolveField($rawSortBy);

        $rawDir = $params[$sortDirKey] ?? ($params[$sortDirAliasKey] ?? null);
        if ($rawDir === null || $rawDir === '') {
            $sortDirection = $sortField->getDefaultDirection();
        } else {
            if (is_array($rawDir)) {
                throw new PaginationException('La direction de tri est invalide.');
            }
            $normalizedDir = strtolower(trim((string)$rawDir));
            if ($normalizedDir !== 'asc' && $normalizedDir !== 'desc') {
                throw new PaginationException("Direction de tri invalide (« {$rawDir} »). Valeurs autorisées : asc, desc.");
            }
            $sortDirection = $normalizedDir;
        }

        $afterRaw = $params[$cursorKey] ?? ($params[$afterKey] ?? null);
        $beforeRaw = $params[$beforeKey] ?? null;

        if (is_array($afterRaw) || is_array($beforeRaw)) {
            throw new PaginationException('Paramètre de curseur invalide.');
        }

        $after = is_string($afterRaw) ? trim($afterRaw) : '';
        $before = is_string($beforeRaw) ? trim($beforeRaw) : '';

        if ($after !== '' && $before !== '') {
            throw new PaginationException('Impossible de combiner « cursor » et « before » dans la même requête.');
        }

        $backward = $before !== '';
        $cursor = $backward ? $before : ($after !== '' ? $after : null);

        $rawIncludeTotal = $params[$totalKey] ?? null;
        $includeTotal = ($rawIncludeTotal === '1' || $rawIncludeTotal === 1 || $rawIncludeTotal === true || $rawIncludeTotal === 'true');

        return new self(
            $limit,
            $sortField,
            $sortDirection,
            $cursor,
            $backward,
            $includeTotal
        );
    }

    public static function create(
        int $limit,
        SortField $sortField,
        string $sortDirection = 'asc',
        ?string $cursor = null,
        bool $backward = false,
        bool $includeTotal = false
    ): self {
        return new self(
            max(1, min($limit, self::MAX_LIMIT)),
            $sortField,
            strtolower($sortDirection) === 'desc' ? 'desc' : 'asc',
            $cursor !== null && trim($cursor) !== '' ? trim($cursor) : null,
            $backward,
            $includeTotal
        );
    }

    public function getLimit(): int
    {
        return $this->limit;
    }

    public function getSortField(): SortField
    {
        return $this->sortField;
    }

    public function getSortDirection(): string
    {
        return $this->sortDirection;
    }

    public function getCursor(): ?string
    {
        return $this->cursor;
    }

    public function isBackward(): bool
    {
        return $this->backward;
    }

    public function shouldIncludeTotal(): bool
    {
        return $this->includeTotal;
    }
}
