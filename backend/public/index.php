<?php
/**
 * Point d'entrée de l'API REST
 * Kanban Dashboard API
 */

// Autoload simple PSR-4 sans composer obligatoire
spl_autoload_register(function ($class) {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../src/';

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
use App\Controllers\SprintController;
use App\Controllers\TaskController;
use App\Controllers\QuestionController;
use App\Controllers\PropertyController;
use App\Controllers\UserController;

$router = new Router();

// --- Authentification ---
$router->add('POST', '/api/auth/login', [AuthController::class, 'login']);
$router->add('GET', '/api/auth/me', [AuthController::class, 'me']);
$router->add('POST', '/api/auth/logout', [AuthController::class, 'logout']);

// --- Utilisateurs & Logements ---
$router->add('GET', '/api/users', [UserController::class, 'list']);
$router->add('GET', '/api/properties', [PropertyController::class, 'list']);

// --- Sprints ---
$router->add('GET', '/api/sprints', [SprintController::class, 'list']);
$router->add('GET', '/api/sprints/current', [SprintController::class, 'current']);
$router->add('GET', '/api/sprints/{id}', [SprintController::class, 'get']);
$router->add('POST', '/api/sprints/{id}/close', [SprintController::class, 'close']);

// --- Tâches ---
$router->add('POST', '/api/tasks', [TaskController::class, 'create']);
$router->add('PUT', '/api/tasks/{id}', [TaskController::class, 'update']);
$router->add('PATCH', '/api/tasks/{id}', [TaskController::class, 'update']);
$router->add('PATCH', '/api/tasks/{id}/status', [TaskController::class, 'updateStatus']);
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

// Exécution de la requête
$router->dispatch();
