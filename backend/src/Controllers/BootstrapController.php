<?php

namespace App\Controllers;

use App\Auth;
use App\Database;
use App\Response;

class BootstrapController {
    /**
     * GET /api/bootstrap
     * Charge en une seule requête l'état initial complet de l'application.
     */
    public function index(): void {
        $db = Database::getConnection();
        $currentUser = Auth::getCurrentUser();
        $users = UserController::fetchUsersList($db, $currentUser);

        if (!$currentUser) {
            Response::json([
                'success' => true,
                'authenticated' => false,
                'user' => null,
                'users' => $users,
            ]);
        }

        $properties = PropertyController::fetchPropertiesList($db, true);
        $sprints = SprintController::fetchSprintsList($db);

        $activeSprint = null;
        foreach ($sprints as $sprint) {
            if (($sprint['status'] ?? '') === 'active') {
                $activeSprint = $sprint;
                break;
            }
        }
        if ($activeSprint === null && !empty($sprints)) {
            $activeSprint = $sprints[0];
        }

        $sprintDetails = $activeSprint
            ? SprintController::fetchSprintDetailsPayload($db, $activeSprint, $currentUser)
            : null;

        Response::json([
            'success' => true,
            'authenticated' => true,
            'user' => $currentUser,
            'users' => $users,
            'properties' => $properties,
            'sprints' => $sprints,
            'sprint_details' => $sprintDetails,
        ]);
    }
}
