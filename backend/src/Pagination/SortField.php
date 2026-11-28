<?php

declare(strict_types=1);

namespace App\Pagination;

/**
 * Définit une clé de tri autorisée (liste blanche) et la liste ordonnée de ses SortTerm.
 */
final class SortField
{
    private string $key;
    private string $defaultDirection;
    /** @var SortTerm[] */
    private array $terms;

    /**
     * @param SortTerm[] $terms
     */
    public function __construct(string $key, array $terms, string $defaultDirection = 'asc')
    {
        if (empty($terms)) {
            throw new \LogicException("SortField '{$key}' doit définir au moins un SortTerm.");
        }
        $this->key = $key;
        $this->terms = array_values($terms);
        $this->defaultDirection = strtolower($defaultDirection) === 'desc' ? 'desc' : 'asc';
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function getDefaultDirection(): string
    {
        return $this->defaultDirection;
    }

    /**
     * @return SortTerm[]
     */
    public function getTerms(): array
    {
        return $this->terms;
    }
}
