<?php

namespace App;

class Router {
    private array $routes = [];

    public function add(string $method, string $pattern, $handler): void {
        $this->routes[] = [
            'method' => strtoupper($method),
            'pattern' => $pattern,
            'handler' => $handler
        ];
    }

    public function dispatch(): void {
        $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($requestMethod === 'OPTIONS') {
            Response::json(['status' => 'OK']);
        }

        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

        // Nettoyage du préfixe de sous-répertoire éventuel (ex: /kanban/api/...)
        $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
        if ($scriptDir !== '/' && strpos($uri, $scriptDir) === 0) {
            $uri = substr($uri, strlen($scriptDir));
        }

        $uri = '/' . ltrim($uri, '/');

        foreach ($this->routes as $route) {
            if ($route['method'] !== $requestMethod) {
                continue;
            }

            // Convertit le pattern en regex : /api/tasks/{id} => #^/api/tasks/([0-9]+)$#
            $regex = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '([^/]+)', $route['pattern']);
            $regex = '#^' . $regex . '$#';

            if (preg_match($regex, $uri, $matches)) {
                array_shift($matches); // Supprime le match complet

                $handler = $route['handler'];
                if (is_array($handler)) {
                    [$class, $method] = $handler;
                    $controller = new $class();
                    call_user_func_array([$controller, $method], $matches);
                } else if (is_callable($handler)) {
                    call_user_func_array($handler, $matches);
                }
                return;
            }
        }

        Response::error("Route introuvable : {$requestMethod} {$uri}", 404);
    }
}
