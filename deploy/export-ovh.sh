#!/usr/bin/env bash
# ==============================================================================
# Script de préparation du déploiement hébergement web mutualisé (Apache / PHP)
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/deploy/www"

echo "==> 1. Compilation du Frontend React / Vite..."
cd "$PROJECT_ROOT/frontend"
PATH="/usr/local/Cellar/node/22.10.0/bin:$PATH" npm run build

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

echo "==> 5. Copie des scripts SQL pour phpMyAdmin..."
cp "$PROJECT_ROOT/backend/database/schema.sql" "$BUILD_DIR/database/"
cp "$PROJECT_ROOT/backend/database/seed.sql" "$BUILD_DIR/database/"

echo "==> 6. Création du fichier .htaccess racine pour Apache..."
cat << 'EOF' > "$BUILD_DIR/.htaccess"
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    # Redirection de l'API vers le sous-dossier api/
    RewriteRule ^api/(.*)$ api/index.php [QSA,L]

    # Redirection SPA (Frontend React) pour toutes les autres requêtes
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
// et renseignez les identifiants de votre base de données MySQL.
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
echo "✅ Package de déploiement généré avec succès dans : deploy/www/"
echo "Vous pouvez envoyer le contenu de deploy/www/ dans le dossier www/ de votre hébergement."
echo "------------------------------------------------------------------"
