<?php

namespace App\Controllers;

use App\Auth;
use App\Database;
use App\Response;
use App\Pagination\PaginationException;

class BootstrapController {
    /**
     * GET /api/bootstrap
     * Charge en une seule requête l'état initial paginé de l'application.
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

        try {
            $sprintDetails = $activeSprint
                ? SprintController::fetchSprintDetailsPayload($db, $activeSprint, $currentUser, $_GET)
                : null;
        } catch (PaginationException $e) {
            Response::error($e->getMessage(), $e->getStatusCode());
        }

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
