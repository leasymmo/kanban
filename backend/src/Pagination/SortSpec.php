<?php

declare(strict_types=1);

namespace App\Pagination;

/**
 * Registre strict des colonnes de tri autorisées pour une ressource.
 */
final class SortSpec
{
    /** @var array<string, SortField> */
    private array $fields = [];
    /** @var array<string, string> */
    private array $aliases = [];
    private string $defaultFieldKey;

    /**
     * @param SortField[] $fields
     * @param array<string, string> $aliases
     */
    public function __construct(array $fields, string $defaultFieldKey, array $aliases = [])
    {
        foreach ($fields as $field) {
            $this->fields[$field->getKey()] = $field;
        }
        if (!isset($this->fields[$defaultFieldKey])) {
            throw new \LogicException("Clé de tri par défaut inconnue : {$defaultFieldKey}");
        }
        $this->defaultFieldKey = $defaultFieldKey;
        $this->aliases = $aliases;
    }

    public function getDefaultFieldKey(): string
    {
        return $this->defaultFieldKey;
    }

    public function resolveField(?string $rawSortBy): SortField
    {
        if ($rawSortBy === null || trim($rawSortBy) === '') {
            return $this->fields[$this->defaultFieldKey];
        }

        $key = strtolower(trim($rawSortBy));
        if (isset($this->aliases[$key])) {
            $key = $this->aliases[$key];
        }

        if (!isset($this->fields[$key])) {
            $allowed = implode(', ', array_keys($this->fields));
            throw new PaginationException("Colonne de tri invalide (« {$rawSortBy} »). Valeurs autorisées : {$allowed}.");
        }

        return $this->fields[$key];
    }

    /**
     * @return string[]
     */
    public function getAllowedKeys(): array
    {
        return array_keys($this->fields);
    }
}
