<?php

declare(strict_types=1);

namespace App\Pagination;

/**
 * Enveloppe de résultat standardisée pour toute réponse API paginée.
 */
final class PaginatedResult
{
    /** @var array<int, array<string, mixed>> */
    private array $data;
    private int $limit;
    private bool $hasMore;
    private bool $hasPrevious;
    private ?string $nextCursor;
    private ?string $previousCursor;
    private ?int $total;

    /**
     * @param array<int, array<string, mixed>> $data
     */
    public function __construct(
        array $data,
        int $limit,
        bool $hasMore,
        bool $hasPrevious,
        ?string $nextCursor,
        ?string $previousCursor,
        ?int $total = null
    ) {
        $this->data = $data;
        $this->limit = $limit;
        $this->hasMore = $hasMore;
        $this->hasPrevious = $hasPrevious;
        $this->nextCursor = $nextCursor;
        $this->previousCursor = $previousCursor;
        $this->total = $total;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getData(): array
    {
        return $this->data;
    }

    /**
     * @return array{
     *   limit: int,
     *   has_more: bool,
     *   has_previous: bool,
     *   next_cursor: ?string,
     *   previous_cursor: ?string,
     *   total: ?int
     * }
     */
    public function getPaginationMeta(): array
    {
        return [
            'limit' => $this->limit,
            'has_more' => $this->hasMore,
            'has_previous' => $this->hasPrevious,
            'next_cursor' => $this->nextCursor,
            'previous_cursor' => $this->previousCursor,
            'total' => $this->total,
        ];
    }

    /**
     * @return array{
     *   data: array<int, array<string, mixed>>,
     *   pagination: array{
     *     limit: int,
     *     has_more: bool,
     *     has_previous: bool,
     *     next_cursor: ?string,
     *     previous_cursor: ?string,
     *     total: ?int
     *   }
     * }
     */
    public function toArray(): array
    {
        return [
            'data' => $this->data,
            'pagination' => $this->getPaginationMeta(),
        ];
    }
}
