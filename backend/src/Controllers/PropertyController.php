<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use PDO;

class PropertyController {
    /**
     * GET /api/properties
     * Liste des logements actifs pour le regroupement
     */
    public function list(): void {
        $db = Database::getConnection();

        $stmt = $db->query("SELECT * FROM properties WHERE is_active = 1 ORDER BY name ASC");
        $properties = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'properties' => $properties
        ]);
    }
}
