<?php
/**
 * Configuration locale spécifique à l'environnement
 * Renommez ce fichier en "config.local.php" (ignoré par Git)
 * et renseignez vos identifiants de base de données.
 */

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
