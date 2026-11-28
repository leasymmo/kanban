<?php

declare(strict_types=1);

namespace App\Pagination;

/**
 * Encodage et décodage de curseurs opaques Base64URL liés au critère de tri actif.
 */
final class CursorCodec
{
    /**
     * @param array<int, int|float|string> $values
     */
    public static function encode(string $sortBy, string $sortDirection, array $values): string
    {
        $payload = json_encode([
            's' => $sortBy,
            'd' => strtolower($sortDirection),
            'v' => array_values($values),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if ($payload === false) {
            throw new PaginationException('Impossible de sérialiser le curseur de pagination.', 500);
        }

        return rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
    }

    /**
     * Décode et valide un curseur opaque vis-à-vis du SortField et de la direction actifs.
     *
     * @return array<int, int|float|string>
     */
    public static function decode(string $token, SortField $sortField, string $sortDirection): array
    {
        $trimmed = trim($token);
        if ($trimmed === '' || strlen($trimmed) > 2048 || !preg_match('/^[A-Za-z0-9\-_]+$/', $trimmed)) {
            throw new PaginationException('Format de curseur invalide.');
        }

        $padded = strtr($trimmed, '-_', '+/');
        $mod = strlen($padded) % 4;
        if ($mod > 0) {
            $padded .= str_repeat('=', 4 - $mod);
        }

        $json = base64_decode($padded, true);
        if ($json === false) {
            throw new PaginationException('Curseur illisible.');
        }

        $decoded = json_decode($json, true);
        if (!is_array($decoded)) {
            throw new PaginationException('Curseur JSON invalide.');
        }

        $cursorSort = isset($decoded['s']) && is_string($decoded['s']) ? strtolower($decoded['s']) : '';
        $cursorDir = isset($decoded['d']) && is_string($decoded['d']) ? strtolower($decoded['d']) : '';
        $rawValues = $decoded['v'] ?? null;

        if ($cursorSort !== $sortField->getKey() || $cursorDir !== strtolower($sortDirection)) {
            throw new PaginationException('Le curseur ne correspond plus aux paramètres de tri actuels.');
        }

        $terms = $sortField->getTerms();
        if (!is_array($rawValues) || count($rawValues) !== count($terms)) {
            throw new PaginationException('Structure de curseur incompatible avec ce tri.');
        }

        $validated = [];
        foreach ($terms as $index => $term) {
            $validated[] = $term->validateCursorValue($rawValues[$index]);
        }

        return $validated;
    }
}
