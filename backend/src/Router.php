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

        $rawUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

        // Nettoyage de l'URI : extrait le chemin relatif à l'API de manière transparente
        $normalize = function(string $path): string {
            $path = '/' . trim($path, '/');
            $pos = strpos($path, '/api');
            if ($pos !== false) {
                $path = substr($path, $pos + 4);
            }
            return '/' . trim($path, '/');
        };

        $normalizedUri = $normalize($rawUri);

        foreach ($this->routes as $route) {
            if ($route['method'] !== $requestMethod) {
                continue;
            }

            $normalizedPattern = $normalize($route['pattern']);

            // Convertit le pattern en regex : /tasks/{id} => #^/tasks/([^/]+)$#
            $regex = preg_replace('/\{([a-zA-Z0-9_]+)\}/', '([^/]+)', $normalizedPattern);
            $regex = '#^' . $regex . '$#';

            if (preg_match($regex, $normalizedUri, $matches)) {
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

        Response::error("Route introuvable : {$requestMethod} {$rawUri}", 404);
    }
}
