# Dashboard Kanban Hebdomadaire en Sprints

Dashboard de gestion de tâches, d'hébergements et de réunions d'équipe hebdomadaires en sprints, conçu pour remplacer un compte rendu texte partagé par une interface réactive adaptée au travail préparatoire et à l'animation de séance en direct.

L'application fonctionne de manière autonome sur tout hébergement web mutualisé standard (**Apache + PHP 8 + MySQL**, ex. OVHcloud) sans serveur Node.js persistant, conteneur Docker ni processus d'arrière-plan.

---

## 🎯 Fonctionnalités clés

### 1. Cycle de Sprints Hebdomadaires & Bascule en réunion
* **Sprints ouverts sans contrainte calendaire** : le sprint actif reste éditable jusqu'à la clôture explicite validée par un administrateur en fin de réunion.
* **Sélecteur de sprint épuré** : indication directe `(En cours)` ou `(Archivé)` dans la liste, avec badge `Lecture seule` lorsque le sprint consulté est archivé.
* **Règle de report automatique à la clôture** :
  * **Tâches terminées (`✅ Fait`)** : archivées dans le sprint clôturé.
  * **Tâches actives non terminées** : reportées sur le nouveau sprint avec leur statut actuel et 100 % de leurs sous-tâches (les sous-tâches cochées restent cochées tout en préservant l'état figé des sprints déjà clos).
  * **Tâches en attente (`pending`) attribuées** : activées sur le nouveau sprint au statut `⏳ À faire` avec le tag *« Nouveau »*.
  * **Tâches en attente non attribuées** : conservées en `pending` pour attribution ultérieure.
  * **Propositions indicatives des questions** : purgées automatiquement à la clôture du sprint (seules les questions et leurs réponses définitives sont conservées dans l'historique du sprint clos).

### 2. Comptes, Permissions & Administration
* **Lecture (`read`)** : consultation seule des tâches, questions et comptes rendus.
* **Écriture (`write`)** : création de tâches/questions, édition/suppression de ses propres questions, de sa réponse indicative (1 max par question), et des tâches qui lui sont attribuées (ou non attribuées qu'il a créées).
* **Administrateur (`admin`)** : gestion complète (utilisateurs, hébergements avec réordonnancement/archivage, sprints et réouverture de sprint, attribution des tâches orphelines, clôture de réunion). Le **Panneau d'Administration** est accessible directement depuis le menu du profil utilisateur (avatar en haut à droite).

### 3. Tableau Kanban & Modales de Tâches
* **Deux modes d'affichage** :
  * **Par Statut** : `⏳ À faire`, `🚧 En cours`, `❌ Bloqué`, `✅ Fait` avec glisser-déposer fluide entre colonnes et réordonnancement.
  * **Par Logement / Catégorie** : regroupement par hébergement actif, avec réattribution rapide et création contextuelle.
* **Sous-tâches hiérarchiques** jusqu'à 4 niveaux avec réordonnancement par glisser-déposer dans la modale.
* **Création multi-logements & sélecteur rapide** : bouton **`Tout sélectionner | Aucun`** dans la modale classique et dans la modale d'ajout rapide en séance pour créer en une fois une tâche pour tout ou partie des hébergements.

### 4. Onglet « Questions » (Préparation avant réunion)
* Interface épurée dédiée à la préparation en amont de la séance :
  * Filtrage par associé (`Mes questions`, `Toutes` affiché en pleine largeur `grid-cols-1`, ou par prénom).
  * Cartes **toujours dépliées** présentant directement l'intitulé et le détail de la question, sans statut ni réponse définitive (renseignée uniquement pendant la réunion).
  * **Réponse indicative facultative (1 max par associé et par question)** : chaque associé peut ajouter, modifier ou supprimer sa propre piste de réponse avant la réunion (contrainte appliquée à la fois en base via `UNIQUE KEY (question_id, user_id)` et par l'API HTTP `409`).

### 5. Vue Réunion dédiée (Pilotage en 3 étapes)
1. **Étape 1 — Rétrospective par Associé** :
   * Tâches mises en avant (`★`) puis accordéon *« Autres tâches »*, tous deux triés automatiquement par statut : **`✅ Fait` → `🚧 En cours` → `❌ Bloqué` → `⏳ À faire`**.
   * Mise à jour du statut, cochage de sous-tâches et bascule d'étoile en direct.
2. **Étape 2 — Revue des Questions & Décisions** :
   * Ajout (`Q`) et édition de questions directement en séance.
   * Champ texte classique (`<input type="text">`) affiché directement sur chaque question : la touche **`Entrée`** enregistre immédiatement la réponse définitive et place le focus sur la question suivante.
   * Bouton **`Retenir`** sur chaque proposition indicative pour pré-remplir le champ de décision en un clic.
3. **Étape 3 — Plan d'Action & Tâches orphelines** :
   * Attribution en un clic des tâches en attente non attribuées et relecture des tâches planifiées par associé pour le sprint suivant.
* **Super-dock flottant unifié** (`MeetingControlDock`) : regroupe les ancres par associé (avec compteurs contextuels et infobulles), l'ancre *À attribuer* à l'étape 3 et le bouton **`+` Ajouter une tâche en attente** séparé par un trait.
* **Raccourcis clavier** : `1`/`2`/`3` (étapes), `J`/`K` (associé suivant/précédent), `0` (bloc *À attribuer*), `E` (accordéon *Autres tâches*), `N` / `+` / `=` (nouvelle tâche en attente), `Q` (nouvelle question), `Shift + C` (clôturer le sprint), `?` / `H` (mémo raccourcis), `Échap` (fermer).

### 6. Notifications temps réel (Toasts)
* Retours visuels flottants en bas de page (`ToastContainer`) pour chaque création, modification, suppression, bascule ou erreur API, avec repositionnement automatique au-dessus du dock sur mobile en Vue Réunion.

---

## 🏗️ Architecture Technique

* **Frontend** : React 18.3, TypeScript 5.6, Tailwind CSS 3.4, Lucide Icons, Vite 5.
* **Backend** : API REST en **PHP 8 natif avec PDO**, requêtes préparées, transactions SQL et authentification par jeton (`user_sessions`).
* **Base de données** : MySQL (scripts `schema.sql` + migrations `migration_v2.sql` à `migration_v11.sql`, appliquées automatiquement et de façon idempotente au démarrage via `Database::migrateSchema()`).
* **Hébergement** : package statique + API PHP autonome généré dans `deploy/www/` pour Apache / OVHcloud.

---

## 🚀 Installation & Déploiement (OVH / Apache + MySQL)

### 1. Base de données MySQL
1. Connectez-vous à votre interface MySQL (ex. phpMyAdmin).
2. Pour une installation vierge, exécutez `backend/database/schema.sql` (puis optionnellement `backend/database/seed.sql`).
3. Pour une mise à jour d'une base existante, les migrations (`v2` à `v11`) s'appliquent automatiquement via PHP, ou manuellement dans phpMyAdmin avec `backend/database/migration_v11.sql` (qui supprime `status`, `answered_by`, `answered_at` de `questions` et ajoute l'unicité sur `question_answers`).

### 2. Configuration des accès
Copiez le fichier d'exemple et renseignez vos identifiants MySQL :
```bash
cp backend/config/config.local.example.php backend/config/config.local.php
```
*(Ou utilisez un fichier `backend/.env` local ; le script de déploiement génère automatiquement `config.local.php` dans le package exporté.)*

Exemple pour `backend/config/config.local.php` :
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

### 3. Build & Génération du package de déploiement
```bash
bash deploy/export-ovh.sh
```
Ce script compile le frontend (`tsc && vite build`) et régénère le dossier `deploy/www/` prêt à être téléversé dans le dossier racine de l'hébergeur (`www/` ou `public_html/`) via SFTP/FTP.

---

## 💻 Développement Local

### Prérequis
* Node.js 20+ (ou 22+)

### Lancer le frontend et vérifier la compilation
```bash
cd frontend
npm install
npm run dev
```
Pour vérifier le typage TypeScript et la compilation de production :
```bash
cd frontend && npx tsc --noEmit && npm run build
```

---

## 📄 Licence

Ce projet est sous licence MIT.
