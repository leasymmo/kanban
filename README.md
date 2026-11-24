# Dashboard Kanban Hebdomadaire en Sprints (Style Trello)

Dashboard de gestion de tâches et de réunions d'équipe hebdomadaires, remplaçant un compte rendu texte partagé par un Kanban réactif inspiré de Trello, fonctionnant en sprints hebdomadaires.

L'application est conçue pour fonctionner de manière autonome sur tout hébergement web standard (**Apache + PHP + MySQL**, type offre mutualisée OVHcloud) sans nécessiter de serveur dédié, de conteneur Docker ni de processus d'arrière-plan.

---

## 🎯 Fonctionnalités clés

1. **Cycle de Sprints Hebdomadaires sans contrainte rigide** :
   * Le sprint en cours reste ouvert et modifiable tant que la réunion d'équipe n'est pas clôturée (qu'elle se tienne le lundi ou un autre jour).
   * **Bascule explicite** : l'administrateur valide la clôture en fin de séance.
   * **Règle de report conditionnel** :
     * Tâche non terminée ➔ reportée au sprint suivant avec **100% de ses sous-tâches** (les sous-tâches faites restent cochées ✅ pour préserver l'historique de l'avancement).
     * Tâche terminée ➔ archivée avec le sprint clôturé.

2. **Comptes et Contrôle des Rôles** :
   * **Lecture** : Consultation seule, aucune modification ni suppression.
   * **Écriture** : Peut modifier et supprimer uniquement ses propres tâches (`assigned_to = lui`) ou les tâches non attribuées qu'il a lui-même créées.
   * **Admin** : Accès complet, paramétrage, attribution des tâches orphelines et clôture de sprint.

3. **Pool des « Tâches non attribuées »** :
   * Tout compte avec droits d'écriture peut créer une tâche orpheline dans le pool commun.
   * **Seul un administrateur peut attribuer une tâche non attribuée à un membre de l'équipe.**

4. **Deux modes d'affichage des tâches** :
   * **Vue par Statut (Kanban)** : *À faire*, *🚧 En cours*, *❌ Bloqué*, *✅ Fait* avec glisser-déposer fluide.
   * **Vue par Propriété / Catégorie** : regroupement par projet, logement ou secteur.

5. **Onglet « Questions stratégiques »** :
   * Sujets à aborder en réunion regroupés par membre de l'équipe, avec filtres individuels et statut de résolution.

6. **Vue Réunion Dédiée** :
   * Écran de pilotage en 3 temps : Rétrospective par membre, Revue des questions, Attribution du pool orphelin, et bouton de clôture avec calcul immédiat du report.

---

## 🏗️ Architecture Technique

* **Frontend** : React 18, TypeScript, Tailwind CSS, Lucide Icons, Vite (compilation en fichiers statiques servis par Apache).
* **Backend** : API REST légère en **PHP 8 natif avec PDO**, requêtes préparées et transactions sécurisées.
* **Base de données** : MySQL (compatible phpMyAdmin).
* **Hébergement** : 100% compatible hébergement mutualisé standard (aucun démon Node.js persistant).

---

## 🚀 Installation & Déploiement

### 1. Base de données MySQL
1. Connectez-vous à votre interface d'administration MySQL (ex: phpMyAdmin).
2. Exécutez le script de structure : `backend/database/schema.sql`.
3. Optionnel : exécutez le script de données de test : `backend/database/seed.sql`.

### 2. Configuration des accès
Copiez le fichier d'exemple et renseignez vos identifiants de base de données :
```bash
cp backend/config/config.local.example.php backend/config/config.local.php
```

Exemple de contenu pour `backend/config/config.local.php` :
```php
<?php
return [
    'driver' => 'mysql',
    'mysql' => [
        'host' => 'votre-serveur.mysql.db',
        'database' => 'nom_de_votre_base',
        'username' => 'votre_utilisateur',
        'password' => 'VOTRE_MOT_DE_PASSE_SECRET',
        'charset' => 'utf8mb4',
    ]
];
```

### 3. Génération du package de déploiement
Exécutez le script d'export :
```bash
./deploy/export-ovh.sh
```
Ce script compile le frontend et génère un dossier prêt à l'emploi dans `deploy/www/`.

Téléversez ensuite l'ensemble du contenu de `deploy/www/` dans le dossier racine de votre hébergeur web (ex: `www/` ou `public_html/`) via SFTP ou FTP.

---

## 💻 Développement Local

### Prérequis
* Node.js 20+ ou 22+

### Démarrage du frontend :
```bash
cd frontend
npm install
npm run dev
```
Rendez-vous sur `http://localhost:5173`. L'application intègre un mode de données local réactif permettant de tester l'interface, les filtres et la clôture de sprint même sans base de données locale active.

---

## 📄 Licence

Ce projet est sous licence MIT.
