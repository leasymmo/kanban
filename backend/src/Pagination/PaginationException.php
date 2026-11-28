<?php

declare(strict_types=1);

namespace App\Pagination;

use InvalidArgumentException;

/**
 * Exception levée lorsqu'un paramètre de pagination, de tri ou de curseur est invalide.
 */
final class PaginationException extends InvalidArgumentException
{
    private int $statusCode;

    public function __construct(string $message, int $statusCode = 400)
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
}
