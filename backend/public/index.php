<?php
/**
 * Point d'entrée de l'API REST
 * Kanban Dashboard API
 */

// Autoload simple PSR-4 sans composer obligatoire
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    
    // Supporte à la fois /backend/public/ (dev local) et /api/ (production deploy/www/api/)
    $baseDir = is_dir(__DIR__ . '/src/') ? __DIR__ . '/src/' : __DIR__ . '/../src/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

use App\Router;
use App\Controllers\AuthController;
use App\Controllers\BootstrapController;
use App\Controllers\SprintController;
use App\Controllers\TaskController;
use App\Controllers\QuestionController;
use App\Controllers\PropertyController;
use App\Controllers\UserController;

$router = new Router();

// --- Test & Diagnostic de connexion ---
$router->add('GET', '/api/test', function() {
    \App\Auth::requireAdmin();
    try {
        $db = \App\Database::getConnection();
        $usersCount = (int)$db->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $sprintsCount = (int)$db->query("SELECT COUNT(*) FROM sprints")->fetchColumn();
        $tasksCount = (int)$db->query("SELECT COUNT(*) FROM tasks")->fetchColumn();
        \App\Response::json([
            'status' => 'ok',
            'counts' => [
                'users' => $usersCount,
                'sprints' => $sprintsCount,
                'tasks' => $tasksCount
            ]
        ]);
    } catch (\Throwable $e) {
        \App\Response::error('Erreur interne', 500);
    }
});

// --- Authentification & Bootstrap ---
$router->add('GET', '/api/bootstrap', [BootstrapController::class, 'index']);
$router->add('POST', '/api/auth/login', [AuthController::class, 'login']);
$router->add('GET', '/api/auth/me', [AuthController::class, 'me']);
$router->add('POST', '/api/auth/logout', [AuthController::class, 'logout']);

// --- Utilisateurs & Logements ---
$router->add('GET', '/api/users', [UserController::class, 'list']);
$router->add('POST', '/api/users', [UserController::class, 'create']);
$router->add('PUT', '/api/users/{id}', [UserController::class, 'update']);
$router->add('DELETE', '/api/users/{id}', [UserController::class, 'delete']);
$router->add('GET', '/api/properties', [PropertyController::class, 'list']);
$router->add('POST', '/api/properties', [PropertyController::class, 'create']);
$router->add('PATCH', '/api/properties/reorder', [PropertyController::class, 'reorder']);
$router->add('PUT', '/api/properties/{id}', [PropertyController::class, 'update']);
$router->add('GET', '/api/properties/{id}/pending-tasks', [PropertyController::class, 'pendingTasks']);
$router->add('POST', '/api/properties/{id}/deactivate', [PropertyController::class, 'deactivate']);
$router->add('POST', '/api/properties/{id}/reactivate', [PropertyController::class, 'reactivate']);

// --- Sprints ---
$router->add('GET', '/api/sprints', [SprintController::class, 'list']);
$router->add('GET', '/api/sprints/current', [SprintController::class, 'current']);
$router->add('GET', '/api/sprints/{id}/summary', [SprintController::class, 'summary']);
$router->add('GET', '/api/sprints/{id}', [SprintController::class, 'get']);
$router->add('PUT', '/api/sprints/{id}', [SprintController::class, 'update']);
$router->add('DELETE', '/api/sprints/{id}', [SprintController::class, 'delete']);
$router->add('POST', '/api/sprints/{id}/close', [SprintController::class, 'close']);
$router->add('POST', '/api/sprints/{id}/reopen', [SprintController::class, 'reopen']);

// --- Tâches ---
$router->add('GET', '/api/tasks', [TaskController::class, 'list']);
$router->add('POST', '/api/tasks', [TaskController::class, 'create']);
$router->add('PATCH', '/api/tasks/reorder', [TaskController::class, 'reorder']);
$router->add('PUT', '/api/tasks/{id}', [TaskController::class, 'update']);
$router->add('PATCH', '/api/tasks/{id}', [TaskController::class, 'update']);
$router->add('PATCH', '/api/tasks/{id}/status', [TaskController::class, 'updateStatus']);
$router->add('PATCH', '/api/tasks/{id}/star', [TaskController::class, 'toggleStar']);
$router->add('DELETE', '/api/tasks/{id}', [TaskController::class, 'delete']);

// --- Sous-tâches ---
$router->add('POST', '/api/tasks/{id}/subtasks', [TaskController::class, 'addSubtask']);
$router->add('PATCH', '/api/subtasks/{id}/toggle', [TaskController::class, 'toggleSubtask']);
$router->add('DELETE', '/api/subtasks/{id}', [TaskController::class, 'deleteSubtask']);

// --- Questions ---
$router->add('GET', '/api/questions', [QuestionController::class, 'list']);
$router->add('POST', '/api/questions', [QuestionController::class, 'create']);
$router->add('PUT', '/api/questions/{id}', [QuestionController::class, 'update']);
$router->add('PATCH', '/api/questions/{id}', [QuestionController::class, 'update']);
$router->add('DELETE', '/api/questions/{id}', [QuestionController::class, 'delete']);
$router->add('POST', '/api/questions/{id}/answers', [QuestionController::class, 'addAnswer']);
$router->add('PUT', '/api/answers/{id}', [QuestionController::class, 'updateAnswer']);
$router->add('PATCH', '/api/answers/{id}', [QuestionController::class, 'updateAnswer']);
$router->add('DELETE', '/api/answers/{id}', [QuestionController::class, 'deleteAnswer']);
$router->add('POST', '/api/questions/{id}/decision', [QuestionController::class, 'setDecision']);
$router->add('PATCH', '/api/questions/{id}/decision', [QuestionController::class, 'setDecision']);

// Exécution de la requête
$router->dispatch();
