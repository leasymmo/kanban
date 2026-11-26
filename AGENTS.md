# Workflow d'exécution — Dashboard Kanban

À chaque demande impliquant une nouvelle fonctionnalité, une évolution ou une correction apportée au projet :

1. **Vérifier le code** avant de finaliser (`cd frontend && npx tsc --noEmit && npm run build`).
2. **Commit et push sur GitHub** chaque changement sur la branche courante (`origin/main`) avec un message descriptif (style Conventional Commits : `feat(...)`, `fix(...)`, `refactor(...)`, `chore(...)`), afin de conserver un historique propre et de pouvoir revenir en arrière en cas de besoin. Ne jamais commiter de secrets ou fichiers ignorés par `.gitignore` (`.env`, `config.local.php`, `deploy/www/`, `ressources/`, `.agents/notes/`).
3. **Exécuter le script de déploiement** `bash deploy/export-ovh.sh` après le commit/push pour régénérer le dossier `deploy/www/`.
