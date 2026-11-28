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

        // Nettoyage de l'URI : extrait le chemin relatif à l'API (ex: /kanban/api/tasks -> /tasks)
        $normalize = function(string $path): string {
            $path = '/' . trim($path, '/');
            $stripped = preg_replace('#^(.*?)/api(?=/|$)#', '', $path, 1);
            return '/' . trim((string)$stripped, '/');
        };

        $normalizedUri = $normalize((string)$rawUri);

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
                    $reflection = new \ReflectionMethod($class, $method);
                    $matches = $this->coerceRouteParams($reflection, $matches);
                    $controller = new $class();
                    call_user_func_array([$controller, $method], $matches);
                } else if (is_callable($handler)) {
                    $reflection = new \ReflectionFunction($handler);
                    $matches = $this->coerceRouteParams($reflection, $matches);
                    call_user_func_array($handler, $matches);
                }
                return;
            }
        }

        Response::error("Route introuvable : {$requestMethod} {$rawUri}", 404);
    }

    /**
     * Valide et convertit les paramètres de route typés `int` pour éviter un TypeError 500 sur URL invalide.
     */
    private function coerceRouteParams(\ReflectionFunctionAbstract $reflection, array $params): array {
        $refParams = $reflection->getParameters();
        foreach ($params as $index => $value) {
            $refParam = $refParams[$index] ?? null;
            if (!$refParam) continue;
            $type = $refParam->getType();
            if ($type instanceof \ReflectionNamedType && $type->getName() === 'int') {
                if (!ctype_digit((string)$value) || (int)$value <= 0) {
                    Response::error('Identifiant de ressource invalide.', 400);
                }
                $params[$index] = (int)$value;
            }
        }
        return $params;
    }
}
