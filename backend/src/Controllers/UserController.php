<?php

namespace App\Controllers;

use App\Database;
use App\Response;
use App\Auth;
use PDO;

class UserController {
    /**
     * GET /api/users
     * Liste des associés pour les filtres et attributions
     */
    public function list(): void {
        Auth::requireAuth();
        $db = Database::getConnection();

        $stmt = $db->query("
            SELECT id, name, email, role, avatar_color, initials
            FROM users
            ORDER BY id ASC
        ");
        $users = $stmt->fetchAll();

        Response::json([
            'success' => true,
            'users' => $users
        ]);
    }
}
