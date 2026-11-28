<?php

declare(strict_types=1);

namespace App\Pagination;

/**
 * Définition structurée d'une requête SQL paginable.
 */
final class PaginatableQuery
{
    private string $selectSql;
    private string $fromSql;
    private string $countFromSql;
    private QueryFilter $filter;

    public function __construct(
        string $selectSql,
        string $fromSql,
        QueryFilter $filter,
        ?string $countFromSql = null
    ) {
        $this->selectSql = $selectSql;
        $this->fromSql = $fromSql;
        $this->filter = $filter;
        $this->countFromSql = $countFromSql ?? $fromSql;
    }

    public function getSelectSql(): string
    {
        return $this->selectSql;
    }

    public function getFromSql(): string
    {
        return $this->fromSql;
    }

    public function getCountFromSql(): string
    {
        return $this->countFromSql;
    }

    public function getFilter(): QueryFilter
    {
        return $this->filter;
    }
}
