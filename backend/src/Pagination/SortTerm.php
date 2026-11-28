<?php

declare(strict_types=1);

namespace App\Pagination;

/**
 * Représente un critère SQL élémentaire dans un tri composite déterministe.
 */
final class SortTerm
{
    public const TYPE_INT = 'int';
    public const TYPE_FLOAT = 'float';
    public const TYPE_STRING = 'string';

    private string $sqlExpr;
    private string $cursorAlias;
    private string $valueType;
    private bool $followsSortDirection;
    private string $fixedDirection;
    private bool $binaryFlag;

    public function __construct(
        string $sqlExpr,
        string $cursorAlias,
        string $valueType = self::TYPE_STRING,
        bool $followsSortDirection = true,
        string $fixedDirection = 'ASC',
        bool $binaryFlag = false
    ) {
        $this->sqlExpr = $sqlExpr;
        $this->cursorAlias = $cursorAlias;
        $this->valueType = $valueType;
        $this->followsSortDirection = $followsSortDirection;
        $this->fixedDirection = strtoupper($fixedDirection) === 'DESC' ? 'DESC' : 'ASC';
        $this->binaryFlag = $binaryFlag;
    }

    public function getSqlExpr(): string
    {
        return $this->sqlExpr;
    }

    public function getCursorAlias(): string
    {
        return $this->cursorAlias;
    }

    public function getValueType(): string
    {
        return $this->valueType;
    }

    public function isBinaryFlag(): bool
    {
        return $this->binaryFlag;
    }

    public function getEffectiveDirection(string $sortDirection, bool $backward): string
    {
        $base = $this->followsSortDirection ? strtoupper($sortDirection) : $this->fixedDirection;
        $normalized = $base === 'DESC' ? 'DESC' : 'ASC';
        if ($backward) {
            return $normalized === 'ASC' ? 'DESC' : 'ASC';
        }
        return $normalized;
    }

    /**
     * Normalise une valeur brute de ligne SQL selon le type attendu par le curseur.
     *
     * @param mixed $rawValue
     * @return int|float|string
     */
    public function normalizeValue($rawValue)
    {
        if ($this->valueType === self::TYPE_INT) {
            return (int)$rawValue;
        }
        if ($this->valueType === self::TYPE_FLOAT) {
            return (float)$rawValue;
        }
        return (string)($rawValue ?? '');
    }

    /**
     * Valide et convertit une valeur extraite d'un curseur utilisateur.
     *
     * @param mixed $rawValue
     * @return int|float|string
     */
    public function validateCursorValue($rawValue)
    {
        if ($rawValue === null || is_array($rawValue) || is_object($rawValue)) {
            throw new PaginationException('Curseur de pagination invalide.');
        }

        if ($this->valueType === self::TYPE_INT) {
            if (!is_int($rawValue) && !(is_string($rawValue) && preg_match('/^-?\d+$/', $rawValue))) {
                throw new PaginationException('Curseur de pagination corrompu (entier attendu).');
            }
            return (int)$rawValue;
        }

        if ($this->valueType === self::TYPE_FLOAT) {
            if (!is_int($rawValue) && !is_float($rawValue) && !is_numeric($rawValue)) {
                throw new PaginationException('Curseur de pagination corrompu (nombre attendu).');
            }
            return (float)$rawValue;
        }

        if (!is_string($rawValue) && !is_numeric($rawValue)) {
            throw new PaginationException('Curseur de pagination corrompu (chaîne attendue).');
        }

        return (string)$rawValue;
    }
}
