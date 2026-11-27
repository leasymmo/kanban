# Design System — Carré d'Hôtes Kanban (`Liquid Glass v1.0`)

Ce document formalise l'identité visuelle définitive de l'application **Carré d'Hôtes Kanban**, basée sur la **Direction A — Apple Design System (Liquid Glass)**, adaptée aux exigences d'un outil SaaS collaboratif de conciergerie immobilière et de pilotage de sprint.

---

## 1. Intention artistique & Principes directeurs

L'interface repose sur une esthétique **lumineuse, aérienne, précise et apaisante**, pensée pour des sessions prolongées et des réunions hebdomadaires de fin de sprint entre associés.

### Piliers visuels (inspirés d'Apple macOS Tahoe / Sequoia & iOS)
1. **Frosted & Liquid Glass hiérarchisé** : le verre dépoli (`backdrop-filter: blur() saturate()`) sert exclusivement à situer la profondeur spatiale des couches de navigation et d'overlay — jamais au détriment de la lisibilité du texte métier.
2. **Surfaces stratifiées (*Layered Interfaces*)** : 5 couches distinctes du fond vers l'utilisateur, chacune avec une opacité, un flou, un rayon et une bordure dédiés.
3. **Bordures soyeuses & reflets spéculaires (*Soft Borders*)** : des contours de `1px` semi-transparents (`rgba(255,255,255,0.68)` en clair, `rgba(255,255,255,0.14)` en sombre) associés à un reflet supérieur subtil (`inset 0 1px 0`) qui donne l'épaisseur du verre.
4. **Ombres naturelles (*Subtle Shadows*)** : doubles ombres diffuses (une ombre de contact courte + une ombre ambiante large à très faible opacité).
5. **Rayons concentriques (*Concentric Radii*)** : règle géométrique `rayon_externe = rayon_interne + padding` (ex. colonne `20px` contenant des cartes `14px` avec `6px–10px` de marge).
6. **Mouvement naturel (*Natural Motion*)** : courbes à ressort maîtrisées (`cubic-bezier(0.22, 1, 0.36, 1)`), micro-interactions rapides (150–240ms) et respect systématique de `prefers-reduced-motion`.

---

## 2. Architecture de transparence & Hiérarchie des couches

> **Règle d'or** : *Ne jamais rendre les cartes Kanban transparentes au point de compromettre le contraste.* Plus un composant contient du texte dense ou des contrôles fins, plus sa surface est opaque.

| Couche | Z-index / Rôle | Opacité (Light) | Opacité (Dark) | Flou (`backdrop-filter`) | Bordure & Reflet |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0. Canvas** | Fond global d'application | `100%` (`#F2F4F8` + halos subtils) | `100%` (`#0B0F17` + halos subtils) | Aucun | — |
| **1. Colonnes & Panneaux secondaires** | Colonnes Kanban, sidebar, barres d'outils secondaires | `58%` (`rgba(255,255,255,0.58)`) | `52%` (`rgba(22,27,38,0.52)`) | `blur(16px) saturate(160%)` | `1px solid rgba(255,255,255,0.65)` / `rgba(255,255,255,0.09)` |
| **2. Contenu dense (Cartes & Tableaux)** | `TaskCard`, lignes de tableau, champs actifs | **`94%`** (`rgba(255,255,255,0.94)`) | **`92%`** (`rgba(28,34,46,0.92)`) | `blur(8px)` (optionnel) | `1px solid rgba(15,23,42,0.07)` / `rgba(255,255,255,0.10)` |
| **3. Chrome flottant (Liquid Glass)** | Header / Navbar, Dock réunion, Segmented Control | `74%` (`rgba(255,255,255,0.74)`) | `72%` (`rgba(20,25,36,0.72)`) | `blur(24px) saturate(180%)` | Reflet haut `inset 0 1px 0` + bordure verre |
| **4. Overlays** | Modales, Dropdowns, Menus contextuels, Toasts, Tooltips | `86%` (`rgba(255,255,255,0.86)`) | `86%` (`rgba(26,32,44,0.86)`) | `blur(28px) saturate(190%)` | Bordure nette + ombre portée profonde |

---

## 3. Design Tokens (`Light` & `Dark`)

Tous les tokens sont centralisés dans :
- [frontend/src/styles/tokens.css](file:///Users/chris/Desktop/kanban/frontend/src/styles/tokens.css) (variables CSS natives)
- [frontend/src/design-system/tokens.ts](file:///Users/chris/Desktop/kanban/frontend/src/design-system/tokens.ts) (miroir TypeScript typé)
- [frontend/tailwind.config.js](file:///Users/chris/Desktop/kanban/frontend/tailwind.config.js) (exposition Tailwind sous le namespace `cdh-*`)

### 3.1 Couleurs principales & Surfaces

| Token CSS | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--cdh-bg-canvas` | `#F2F4F8` | `#0B0F17` | Fond principal de l'application |
| `--cdh-text-primary` | `#1D1D1F` | `#F5F5F7` | Titres, texte principal (contraste > 12:1) |
| `--cdh-text-secondary` | `#5E626B` | `#A1A7B3` | Sous-titres, métadonnées (contraste ≥ 4.8:1) |
| `--cdh-text-tertiary` | `#7E8490` | `#717886` | Placeholders, labels secondaires |
| `--cdh-accent` | `#007AFF` | `#0A84FF` | Actions principales, focus ring, liens actifs |
| `--cdh-accent-hover` | `#0066D6` | `#409CFF` | Survol des boutons primaires |
| `--cdh-accent-soft` | `rgba(0, 122, 255, 0.12)` | `rgba(10, 132, 255, 0.18)` | Fonds de filtres actifs, sélection |
| `--cdh-secondary` | `#5856D6` | `#5E5CE6` | Accent secondaire (sprints, IA/meeting) |

### 3.2 États, Statuts Kanban & Priorités

| Domaine | Token | Light (Texte / Fond) | Dark (Texte / Fond) |
| :--- | :--- | :--- | :--- |
| **À faire (`todo`)** | `--cdh-status-todo` | `#5E626B` / `rgba(142,142,147,0.14)` | `#A1A7B3` / `rgba(142,142,147,0.22)` |
| **En cours (`in_progress`)** | `--cdh-status-progress` | `#B25E00` / `rgba(255,149,0,0.14)` | `#FF9F0A` / `rgba(255,159,10,0.18)` |
| **Bloqué / Litige (`blocked`)** | `--cdh-status-blocked` | `#C81E1E` / `rgba(255,59,48,0.12)` | `#FF453A` / `rgba(255,69,58,0.18)` |
| **Terminé (`done`)** | `--cdh-status-done` | `#1B7A37` / `rgba(52,199,89,0.14)` | `#30D158` / `rgba(48,209,88,0.18)` |
| **Priorité Haute (Urgent)** | `--cdh-priority-high` | `#C81E1E` / `rgba(255,59,48,0.12)` | `#FF6961` / `rgba(255,69,58,0.20)` |
| **Priorité Normale** | `--cdh-priority-medium` | `#0055B3` / `rgba(0,122,255,0.10)` | `#64D2FF` / `rgba(10,132,255,0.18)` |
| **Priorité Basse** | `--cdh-priority-low` | `#5E626B` / `rgba(118,118,128,0.12)` | `#98989D` / `rgba(142,142,147,0.18)` |

### 3.3 Typographie & Échelle typographique

- **Police principale (`--cdh-font-sans`)** : `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Plus Jakarta Sans", system-ui, sans-serif`
- **Police monospace (`--cdh-font-mono`)** : `"SF Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace` (compteurs, dates tabulaires `tabular-nums`, codes logements).

| Rôle | Taille / Line-height | Poids | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- |
| `display` | `24px / 1.2` | `700` | `-0.025em` | Titres de modales majeures / Login |
| `title-lg` | `18px / 1.3` | `600` | `-0.02em` | En-tête de vue / Titre de sprint |
| `title-md` | `15px / 1.35` | `600` | `-0.015em` | Nom d'application, titre de modale |
| `card-title` | `13.5px / 1.4` | `600` | `-0.01em` | Titre de carte Kanban |
| `body` | `13.5px / 1.5` | `400` | `-0.005em` | Descriptions, commentaires, formulaires |
| `ui` | `13px / 1.35` | `500` | `0` | Boutons, onglets, items de menu |
| `caption` | `12px / 1.35` | `500` | `0` | Métadonnées, dates, filtres |
| `micro` | `11px / 1.2` | `600` | `0.02em` | Badges, compteurs, étiquettes |

### 3.4 Espacements, Rayons, Ombres, Flous & Transitions

- **Grille d'espacement (`4px`)** : `4px` (`1`), `8px` (`2`), `10px` (`2.5`), `12px` (`3`), `16px` (`4`), `20px` (`5`), `24px` (`6`), `32px` (`8`).
- **Rayons** : `xs: 6px` (badges), `sm: 8px` (items de menu), `md: 10px` (inputs, segmented items), `lg: 14px` (cartes Kanban), `xl: 18px` (barres flottantes), `2xl: 22px` (colonnes, modales), `pill: 9999px` (filtres, avatars).
- **Flous** : `--cdh-blur-sm: 10px`, `--cdh-blur-md: 16px`, `--cdh-blur-lg: 24px`, `--cdh-blur-xl: 32px`.
- **Transitions** : `--cdh-ease-spring: cubic-bezier(0.22, 1, 0.36, 1)`, `--cdh-ease-out: cubic-bezier(0.16, 1, 0.3, 1)` ; durées `120ms` (hover/press), `180ms` (menus/badges), `240ms` (cartes/modales).

---

## 4. Spécifications des composants & États d'interaction

Chaque composant implémente obligatoirement les 5 états : **`default`**, **`hover`**, **`active` (`scale(0.98)` ou assombrissement)**, **`focus-visible` (anneau `2px solid var(--cdh-accent)` avec `offset: 2px`)**, et **`disabled` (`opacity: 0.45; cursor: not-allowed; pointer-events: none`)**.

1. **Header & Segmented Control** : barre sticky flottante (`Layer 3` Liquid Glass), hauteur `56px–60px`, *Segmented Control* iOS/macOS sur fond `rgba(118,118,128,0.12)` avec pilule active blanche/élevée.
2. **Sidebar / Panneau latéral** : optionnel en vue Réunion ou filtres avancés ; surface `Layer 1` translucide (`blur(16px)`), largeur `260px–280px`, bordure droite `1px hairline`.
3. **Boutons (`Button`)** :
   - `primary` : `#007AFF` texte `#FFFFFF`, reflet supérieur interne, ombre teintée discrète.
   - `secondary` : verre blanc `rgba(255,255,255,0.75)` + bordure hairline, texte `#1D1D1F`.
   - `ghost` : transparent, hover `rgba(118,118,128,0.10)`.
   - `danger` : `#FF3B30` (plein ou teinté soft pour suppression secondaire).
   - Taille tactile minimale : `36px` desktop, `44px` mobile (`min-h-[44px] sm:min-h-[36px]`).
4. **Champs de saisie (`Input`, `Textarea`, `Select`)** : fond `#FFFFFF` (92%) en clair / `rgba(255,255,255,0.06)` en sombre, rayon `10px`, bordure `1px solid rgba(0,0,0,0.10)`, halo focus `0 0 0 3px var(--cdh-accent-soft)`.
5. **Barres de recherche (`SearchInput`)** : fond translucide creusé (`rgba(118,118,128,0.09)`), icône loupe, bouton effacement rapide (`X`), raccourci clavier discret (`⌘K` / `/`).
6. **Filtres (`FilterChip`, `MultiFilterDropdown`)** : pilules compactes (`rounded-full`), état actif sombre (`#1D1D1F` texte `#FFFFFF` en clair) ou teinté accent, menu déroulant en `Layer 4`.
7. **Menus déroulants & Menus contextuels (`Dropdown`, `ContextMenu`)** : panneau `Layer 4` (`blur(28px)`), padding `6px`, items `rounded-[8px]` avec survol teinté `var(--cdh-accent-soft)` ou gris neutre, séparateurs `1px hairline`.
8. **Colonnes Kanban (`KanbanColumn`)** : `Layer 1`, rayon `20px`, padding `12px`, en-tête sobre (point statut 8px + titre 13px semibold + compteur tabulaire discret + bouton `+`).
9. **Cartes Kanban (`TaskCard`)** : `Layer 2` (**opaque à 94%**), rayon `14px`, padding `14px`, hiérarchie en 3 zones :
   - *Haut* : badge logement teinté (ou dot couleur) + indicateur priorité/étoile discret.
   - *Corps* : titre `13.5px` semibold (max 2–3 lignes lisibles) + aperçu sous-tâches.
   - *Pied* : date d'échéance (alerte rouge uniquement si en retard) + barre de progression fine + avatar `24px`.
   - *Drag & Drop* : élévation `shadow-modal` + légère rotation `1deg` lors du drag, indicateur d'insertion bleu `2px` lumineux entre cartes, et alternative clavier/menu contextuel ("Déplacer vers…") conforme WCAG 2.2.
10. **Badges (`Badge`)** : rayon `6px` ou `full`, teinte douce à 12–14% d'opacité et texte foncé contrasté (`≥ 4.5:1`), jamais de couleurs fluo agressives.
11. **Avatars (`Avatar`)** : cercles `24px` (`sm`), `32px` (`md`), `40px` (`lg`), anneau interne `1px solid rgba(255,255,255,0.35)`, initiales centrées en `600`.
12. **Modales (`Modal` / `Sheet`)** : `Layer 4` (`blur(32px)`), rayon `22px`, backdrop `rgba(15,23,42,0.28)` + `blur(6px)`, animation `modal-in` douce, focus trap garanti par `useModalDialog`.
13. **Tooltips** : `Layer 4` inversée (`#1D1D1F` à 90% en clair), rayon `8px`, texte `11.5px`, délai d'apparition `300ms`.
14. **Notifications (`Toast`)** : pilules ou cartes `Layer 4` flottantes en bas à droite, icône cerclée colorée, fermeture manuelle accessible (`32×32px` min).
15. **Tableaux (`Table`)** : `Layer 2`, en-tête translucide collant (`sticky`), séparateurs horizontaux `1px hairline`, lignes `44px` minimum avec survol doux `rgba(0,0,0,0.025)`.
16. **Indicateurs de progression (`ProgressBar`)** : piste `rgba(118,118,128,0.16)` hauteur `4px–6px` arrondie, remplissage `#007AFF` (ou `#34C759` à 100%) avec transition fluide de largeur.

---

## 5. Implémentation technique & Convention d'usage

- **CSS Tokens** : [frontend/src/styles/tokens.css](file:///Users/chris/Desktop/kanban/frontend/src/styles/tokens.css) (importé dans [frontend/src/index.css](file:///Users/chris/Desktop/kanban/frontend/src/index.css)).
- **Tailwind CSS** : [frontend/tailwind.config.js](file:///Users/chris/Desktop/kanban/frontend/tailwind.config.js) étendu avec `cdh.*` (couleurs, flous, ombres, rayons).
- **Primitives React réutilisables** dans `frontend/src/components/ui/` :
  - `GlassSurface` (`layer="column" | "card" | "chrome" | "overlay"`)
  - `Button` (`variant="primary" | "secondary" | "ghost" | "danger"`)
  - `Badge` (`variant="neutral" | "accent" | "success" | "warning" | "danger"`)
  - `Avatar` (`size="xs" | "sm" | "md" | "lg"`)
  - `Input` & `SearchInput`
  - `Modal` (connecté à `useModalDialog`)
  - `ProgressBar`
- **Aperçu interactif complet** (Light / Dark + tous les composants et états) : voir le fichier HTML interactif généré dans l'espace de travail temporaire de cette session.
