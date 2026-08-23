# Chantier : la coquille du hub, puis les suites e2e

*Spécification écrite pour être exécutée dans une conversation neuve. Rien ici ne demande de
connaître l'historique : lire `CLAUDE.md`, ce fichier, et le code suffit.*

**Ordre imposé : la coquille d'abord, l'e2e ensuite.** Découper les parcours de test avant de
changer la navigation obligerait à les redécouper après.

> **Étape A faite (2026-08-09).** `App.tsx` est la coquille, `ZenithScreen.tsx` porte tout
> l'écran de Zénith. Les deux décisions demandées à Jules : écran d'accueil en cartes
> (`ModulePicker`), et réglages en fenêtre commune + section par module
> (`AtlasModule.SettingsSection`). `npm run test` (255), `npm run check` (205) et
> `npm run check:auth` (217) passent à l'identique de l'état d'avant l'étape — ces chiffres ont
> grossi depuis l'écriture de ce document (187/199), voir le journal de `CLAUDE.md`. Le md5 du
> CSS **a changé** (`57f11ca6…` → `fe2ec1c8…`) : cette étape ajoute du CSS neuf (écran d'accueil
> du hub, intitulé de section de réglages), ce n'est pas un déplacement pur — voir le journal.
>
> **Étape B faite (2026-08-23).** `e2e-check.mjs` (1973 lignes) découpé en `e2e/run.mjs`
> (lanceur : navigateur, `check()`, découverte des suites par scan de
> `src/modules/*/e2e/suite.mjs`), `e2e/core.mjs` (socle — PWA, service worker, écran
> d'authentification) et `src/modules/objectifs/e2e/suite.mjs` (Zénith — grille, échelle,
> cérémonies, comptage). `npm run test` (255), `npm run check` (205) et `npm run check:auth`
> (217) passent à l'identique — extraction ligne à ligne vérifiée par sous-chaîne exacte avant
> assemblage, aucun contrôle perdu. Le panneau de réglages (ouverture, rythme quotidien, absence
> de rappel en local) a rejoint la suite `objectifs` plutôt que le socle, par pragmatisme : y
> accéder passe aujourd'hui par l'écran de Zénith. `LEGACY.sansSuiteE2E` a disparu de
> `conventions.test.ts`, sa liste s'étant vidée ; `LEGACY.sansPrefixeCSS` reste, non concerné par
> cette étape. Le md5 du CSS produit est resté `fe2ec1c8…` : cette étape ne touche aucun fichier
> React ni CSS, seulement les scripts e2e.

---

## Pourquoi ce chantier

Chaque module doit être techniquement indépendant, pour deux raisons :

1. **Cohérence.** On se connecte **une seule fois, au niveau du hub**. On choisit ensuite son
   module. Aucun module ne gère de connexion : il reçoit un utilisateur déjà authentifié.
2. **Travail parallèle.** Un agent par module, chacun dans son dossier, sans avoir à lire ni à
   modifier le code des autres.

Aujourd'hui `App.tsx` porte encore tout l'écran de Zénith — 22 imports vers
`./modules/objectifs/`. Tant que c'est le cas, deux agents travaillant sur deux modules
éditent le même fichier.

`src/modules/conventions.test.ts` plafonne déjà ce nombre à 22 : il ne peut que baisser. **En
fin de chantier, abaisser le plafond au nombre réellement atteint.** Zéro est la cible.

---

## Étape A — `App.tsx` devient la coquille

### Cible

```
App.tsx                         portail d'authentification, choix du module,
                                réglages, sauvegarde. Ne connaît aucun domaine.
modules/objectifs/ZenithScreen.tsx    tout l'écran actuel de Zénith
```

### Ce qu'il faut ajouter au contrat

`core/lib/module.ts` gagne un champ : le composant racine du module.

```ts
export interface AtlasModule {
  id: string;
  label: string;
  emoji: string;
  data: ModuleDataStore;
  /** Composant racine. Le hub le rend sans rien savoir de son contenu. */
  Screen: ComponentType<{ user: AppUser }>;
  fromLegacyBackup?(raw: Record<string, unknown>): unknown | null;
}
```

Le hub rend `<module.Screen user={user} />` pour le module choisi. Il ne lui passe rien
d'autre : le module accède aux données par son propre store, et aux réglages par `coreStore`.

### Ce qui reste dans `App.tsx`

Authentification et récupération de mot de passe, choix du module, panneau de réglages,
export/import de la sauvegarde (déjà piloté par le registre), et la plomberie d'erreurs.

### Ce qui part dans le module

Tout le reste : états des objectifs, célébrations, trophées, gestion des paliers, actions,
check-ins, et les vues `accueil` / `objectifs` / `historique` / `trophees` — qui sont des
onglets **internes à Zénith**, pas des modules.

### Deux décisions à prendre avec Jules avant d'écrire

- **Navigation du hub** : un écran d'accueil listant les modules, ou une barre permanente
  permettant de passer de Zénith à Astra sans repasser par un menu ? Sur mobile la seconde est
  plus agréable, mais elle consomme de la hauteur d'écran.
- **Réglages** : un panneau global unique, ou une partie commune (compte, notifications,
  sauvegarde) plus un onglet par module pour ce qui lui appartient — l'objectif de PP
  quotidien, par exemple, n'a de sens que pour Zénith.

### Vérification

`npm run test` et `npm run check` doivent rendre exactement les mêmes chiffres qu'avant :
**187 contrôles en mode local, 199 en mode authentifié**, avec l'unique échec du dimanche
décrit dans le journal de `CLAUDE.md`. Le CSS produit doit garder le md5 `57f11ca6…`.

Un déplacement de code ne change aucun de ces nombres. S'ils bougent, c'est qu'il ne s'agit
plus d'un déplacement.

---

## Étape B — une suite e2e par module

### Le vrai obstacle

`e2e-check.mjs` fait 1 945 lignes et n'est pas une collection de tests : c'est **un flux
linéaire unique**, qui partage une seule page et construit son état au fil de l'eau — charger
les exemples, cocher des paliers, puis vérifier que l'historique en garde la trace.

Le découper n'est donc pas un `mv` : chaque suite devra créer son propre contexte et amener
elle-même l'app dans l'état qu'elle vérifie. C'est là que passe l'essentiel du travail.

### Cible

```
e2e/run.mjs                          lanceur : navigateur, check(), découverte des suites
e2e/core.mjs                         accueil, onboarding, connexion, réglages, sauvegarde
src/modules/objectifs/e2e/suite.mjs  grille, échelle, cérémonies, comptage
src/modules/<autre>/e2e/suite.mjs
```

Chaque suite exporte une fonction :

```js
export async function run({ browser, check, BASE }) { /* … */ }
```

Le lanceur découvre les suites **depuis le registre des modules** : un module sans suite se
voit immédiatement. `conventions.test.ts` exige déjà le dossier `e2e/`.

### En fin d'étape

Retirer `'objectifs'` de `LEGACY.sansSuiteE2E` dans `conventions.test.ts`. Si la liste se vide,
supprimer la liste.

### Vérification

Même exigence qu'à l'étape A : la somme des contrôles des suites doit égaler les chiffres
actuels. Un contrôle perdu dans la réorganisation est un contrôle qu'on croit avoir.

---

## Méthode qui a bien fonctionné jusqu'ici

- **Extraire, ne pas recopier.** Les découpages précédents ont déplacé des plages de lignes
  par script plutôt que retapé du code — aucune erreur de transcription possible.
- **Prouver la neutralité par une empreinte.** Le découpage de `styles.css` a été validé en
  reconcaténant les morceaux et en comparant le md5 à l'original, puis en comparant le CSS
  produit par `vite build` avant et après.
- **Comparer à un état de référence.** Monter une copie du dépôt à l'état précédent et lancer
  les deux, plutôt que de juger un résultat isolé. C'est ce qui a innocenté trois refactorings
  d'un échec e2e préexistant.
- **Une étape, un commit**, avec les chiffres de vérification dans le message.
