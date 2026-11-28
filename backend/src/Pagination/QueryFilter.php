<?php

declare(strict_types=1);

namespace App\Pagination;

/**
 * Constructeur centralisé de clauses WHERE paramétrées pour éviter toute injection SQL.
 */
final class QueryFilter
{
    /** @var string[] */
    private array $clauses = [];
    /** @var array<int, int|float|string> */
    private array $bindings = [];
    private bool $impossible = false;

    public function addRawClause(string $sql, array $bindings = []): self
    {
        $this->clauses[] = $sql;
        foreach ($bindings as $value) {
            $this->bindings[] = $value;
        }
        return $this;
    }

    public function markEmpty(): self
    {
        $this->impossible = true;
        return $this;
    }

    public function isEmptyResult(): bool
    {
        return $this->impossible;
    }

    /**
     * Ajoute une condition IN / IS NULL sûre pour un tableau d'entiers.
     *
     * @param int[] $nonNullIds
     */
    public function whereIntInOrNull(string $columnExpr, array $nonNullIds, bool $includeNull): self
    {
        if (empty($nonNullIds) && !$includeNull) {
            return $this->markEmpty();
        }

        if (!empty($nonNullIds) && !$includeNull) {
            $placeholders = implode(',', array_fill(0, count($nonNullIds), '?'));
            return $this->addRawClause("{$columnExpr} IN ({$placeholders})", $nonNullIds);
        }

        if (empty($nonNullIds) && $includeNull) {
            return $this->addRawClause("{$columnExpr} IS NULL");
        }

        $placeholders = implode(',', array_fill(0, count($nonNullIds), '?'));
        return $this->addRawClause("({$columnExpr} IS NULL OR {$columnExpr} IN ({$placeholders}))", $nonNullIds);
    }

    /**
     * Ajoute une condition IN sûre pour des chaînes validées sur liste blanche.
     *
     * @param string[] $values
     */
    public function whereStringIn(string $columnExpr, array $values): self
    {
        if (empty($values)) {
            return $this->markEmpty();
        }
        $placeholders = implode(',', array_fill(0, count($values), '?'));
        return $this->addRawClause("{$columnExpr} IN ({$placeholders})", $values);
    }

    /**
     * Échappe un terme pour LIKE ... ESCAPE '!'.
     */
    public static function escapeLike(string $term): string
    {
        return '%' . str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $term) . '%';
    }

    /**
     * Extrait une liste de chaînes depuis un paramètre scalaire, CSV ou tableau.
     *
     * @param array<string, mixed> $params
     * @return string[]|null
     */
    public static function parseStringList(array $params, array $keys, array $allowedValues): ?array
    {
        $found = false;
        $values = [];

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
                if (!in_array($clean, $allowedValues, true)) {
                    throw new PaginationException("Valeur de filtre non autorisée pour « {$key} » : {$clean}.");
                }
                if (!in_array($clean, $values, true)) {
                    $values[] = $clean;
                }
            }
        }

        return $found ? $values : null;
    }

    /**
     * Valide une date YYYY-MM-DD optionnelle.
     */
    public static function parseOptionalDate(array $params, string $key): ?string
    {
        if (!isset($params[$key]) || $params[$key] === '') {
            return null;
        }
        if (is_array($params[$key])) {
            throw new PaginationException("Format de date invalide pour « {$key} ».");
        }
        $clean = trim((string)$params[$key]);
        $dt = \DateTime::createFromFormat('Y-m-d', $clean);
        if (!$dt || $dt->format('Y-m-d') !== $clean) {
            throw new PaginationException("Format de date invalide pour « {$key} » (YYYY-MM-DD attendu).");
        }
        return $clean;
    }

    /**
     * Valide un drapeau booléen optionnel ('1'/'0'/'true'/'false').
     */
    public static function parseOptionalBool(array $params, string $key): ?int
    {
        if (!array_key_exists($key, $params) || $params[$key] === '' || $params[$key] === null) {
            return null;
        }
        if (is_array($params[$key])) {
            throw new PaginationException("Paramètre booléen invalide pour « {$key} ».");
        }
        $val = strtolower(trim((string)$params[$key]));
        if (in_array($val, ['1', 'true', 'yes'], true)) {
            return 1;
        }
        if (in_array($val, ['0', 'false', 'no'], true)) {
            return 0;
        }
        throw new PaginationException("Paramètre booléen invalide pour « {$key} ».");
    }

    public function getWhereSql(): string
    {
        if ($this->impossible) {
            return '1 = 0';
        }
        return empty($this->clauses) ? '1 = 1' : implode(' AND ', $this->clauses);
    }

    /**
     * @return array<int, int|float|string>
     */
    public function getBindings(): array
    {
        return $this->impossible ? [] : $this->bindings;
    }
}
