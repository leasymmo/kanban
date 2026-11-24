#!/usr/bin/env bash
# ==============================================================================
# Script de préparation du package de déploiement (Apache / PHP / OVHcloud)
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/deploy/www"

# Détection de Node 22 si présent sur macOS Homebrew
if [ -d "/usr/local/Cellar/node/22.10.0/bin" ]; then
    export PATH="/usr/local/Cellar/node/22.10.0/bin:$PATH"
fi

echo "==> 1. Compilation du Frontend React / Vite..."
cd "$PROJECT_ROOT/frontend"
npm run build

echo "==> 2. Préparation du dossier de déploiement ($BUILD_DIR)..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/api"
mkdir -p "$BUILD_DIR/database"

echo "==> 3. Copie des fichiers frontend statiques..."
cp -R "$PROJECT_ROOT/frontend/dist/"* "$BUILD_DIR/"

echo "==> 4. Copie des fichiers backend PHP..."
cp -R "$PROJECT_ROOT/backend/src" "$BUILD_DIR/api/"
cp -R "$PROJECT_ROOT/backend/config" "$BUILD_DIR/api/"
cp "$PROJECT_ROOT/backend/public/index.php" "$BUILD_DIR/api/index.php"
cp "$PROJECT_ROOT/backend/public/.htaccess" "$BUILD_DIR/api/.htaccess"

# Si un fichier .env local existe, on l'embarque dans api/ pour la production
if [ -f "$PROJECT_ROOT/backend/.env" ]; then
    echo "==> 4b. Copie de backend/.env vers $BUILD_DIR/api/.env..."
    cp "$PROJECT_ROOT/backend/.env" "$BUILD_DIR/api/.env"

    echo "==> 4c. Création de config.local.php pour compatibilité FTP maximale..."
    DB_HOST=$(grep -E '^DB_HOST=' "$PROJECT_ROOT/backend/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    DB_NAME=$(grep -E '^DB_NAME=' "$PROJECT_ROOT/backend/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    DB_USER=$(grep -E '^DB_USER=' "$PROJECT_ROOT/backend/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    DB_PASS=$(grep -E '^DB_PASSWORD=' "$PROJECT_ROOT/backend/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")

    cat << EOF > "$BUILD_DIR/api/config/config.local.php"
<?php
// Configuration générée automatiquement pour OVH
return [
    'driver' => 'mysql',
    'mysql' => [
        'host' => '${DB_HOST:-carredjkanban.mysql.db}',
        'database' => '${DB_NAME:-carredjkanban}',
        'username' => '${DB_USER:-carredjkanban}',
        'password' => '${DB_PASS}',
        'charset' => 'utf8mb4',
    ]
];
EOF
fi

echo "==> 5. Copie des scripts SQL pour phpMyAdmin..."
cp "$PROJECT_ROOT/backend/database/schema.sql" "$BUILD_DIR/database/"
cp "$PROJECT_ROOT/backend/database/seed.sql" "$BUILD_DIR/database/"

# Si la seed de production existe localement dans .agents/notes/, on la copie aussi pour phpMyAdmin
if [ -f "$PROJECT_ROOT/.agents/notes/seed-carredhotes.sql" ]; then
    cp "$PROJECT_ROOT/.agents/notes/seed-carredhotes.sql" "$BUILD_DIR/database/seed-production.sql"
fi

echo "==> 6. Création du fichier .htaccess racine pour Apache OVH..."
cat << 'EOF' > "$BUILD_DIR/.htaccess"
<IfModule mod_rewrite.c>
    RewriteEngine On

    # Redirection des requêtes API vers api/index.php
    RewriteRule ^api/(.*)$ api/index.php [QSA,L]

    # Redirection SPA React pour toutes les autres requêtes
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_headers.c>
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With"
</IfModule>
EOF

echo "==> 7. Création de config.local.example.php..."
cat << 'EOF' > "$BUILD_DIR/api/config/config.local.example.php"
<?php
// Renommez ce fichier en config.local.php sur votre serveur
// si vous n'utilisez pas de fichier .env.
return [
    'driver' => 'mysql',
    'mysql' => [
        'host' => 'votre-serveur.mysql.db',
        'database' => 'nom_de_base',
        'username' => 'utilisateur_mysql',
        'password' => 'VOTRE_MOT_DE_PASSE_MYSQL_ICI',
        'charset' => 'utf8mb4',
    ]
];
EOF

echo "------------------------------------------------------------------"
echo "✅ Package prêt dans le dossier : deploy/www/"
echo "Contenu à envoyer sur le serveur OVH :"
echo "  - .htaccess"
echo "  - index.html"
echo "  - assets/"
echo "  - api/"
echo "------------------------------------------------------------------"
