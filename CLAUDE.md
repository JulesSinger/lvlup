# Atlas — instructions de travail

Ce fichier est lu automatiquement au démarrage de chaque conversation ouverte sur ce dépôt.
Il existe parce que le projet est construit **au fil de plusieurs conversations sans mémoire
partagée** : ce qui n'est pas écrit ici est oublié entre deux sessions.

**Le README décrit l'application. Ce fichier décrit comment y toucher.** En cas de
contradiction entre les deux, ce fichier fait foi et le README doit être corrigé.

---

## 1. Ce qu'est le projet

**Atlas** est une application web personnelle, destinée à Jules et à quelques proches. C'est un
**hub multi-modules** : chaque module couvre un domaine de la vie, avec ses propres écrans,
ses données et sa logique.

| Module | Nom affiché | Domaine | État |
|---|---|---|---|
| `objectifs` | **Zénith** | suivi d'objectifs par paliers, rangs Fer → Challenger | en production |
| `budget` | **Astra** | dépenses, catégories, comparaison mensuelle | V1 (5/5) livrée ; chantier enveloppes d'épargne terminé (3/3, voir `docs/etude-astra-epargne.md` §8) |
| `flashcards` | **Orbite** | révision par répétition espacée, système de Leitner à 5 boîtes | découpage complet livré, rendu mobile vérifié — voir `docs/etude-flashcards.md` §9, §15, §16 |
| — | — | sport, et d'autres plus tard | envisagé |

Les noms affichés forment une famille céleste — Atlas porte la voûte, Zénith en est le point
le plus haut, Astra les étoiles. Un futur module suit la même veine.

Le dépôt a commencé sous le seul nom de Zénith, quand l'app se confondait avec son unique
domaine. **Zénith désigne désormais le module objectifs, et non l'application entière** — voir
§4 pour ce que ce renommage implique, et surtout ce qu'il ne doit pas toucher.

Toute décision technique se prend sous cette contrainte, dans cet ordre :

1. **Gratuit à vie.** Aucun service payant, aucune carte bancaire, aucun palier gratuit qui
   expire. Le socle actuel (Supabase free + Cloudflare Pages) respecte cette règle — toute
   dépendance nouvelle doit la respecter aussi. Si une fonctionnalité exige de payer, elle
   n'est pas retenue : on cherche une autre façon de la rendre, ou on y renonce.
2. **Utilisable par une personne seule, dès le premier jour.** Pas de fonctionnalité sociale
   tant que les utilisateurs se comptent sur une main.
3. **Ne jamais perdre une donnée saisie.** C'est le seul bug impardonnable ici. Toute écriture
   doit survivre à une coupure réseau (voir la file d'attente, §6).

---

## 2. Pile technique

| Domaine | Choix |
|---|---|
| Interface | React 19, TypeScript, Vite 8 |
| Base, comptes, droits | Supabase (Postgres + Auth + Row Level Security) |
| Notifications | Web Push (VAPID) via Supabase Edge Function |
| Tests unitaires | Vitest, fichiers `*.test.ts` **à côté** du fichier testé |
| Tests bout en bout | Playwright, via `e2e/run.mjs` (socle) + une suite par module (`src/modules/<id>/e2e/suite.mjs`) |
| Lint | oxlint |
| Hébergement | Cloudflare Pages |

**Node 22 minimum** (Vite 8 s'appuie sur Rolldown). En local : `nvm use 22`.

### Commandes

```bash
npm run dev        # développement, http://localhost:5173
npm run build      # tsc -b && vite build → dist/
npm run test       # tests unitaires (vitest)
npm run check      # vérifications bout en bout sur le build
npm run lint       # oxlint
```

`npm run test` et `npm run check` doivent passer avant tout commit. Pas d'exception.

### Lancer les vérifications de bout en bout

**`npm run check` ne démarre aucun serveur** : il attend que le build soit déjà servi. Oublier
cette étape produit un `net::ERR_CONNECTION_REFUSED` qui ressemble à un bug de l'app.

```bash
npm run build && npm run preview &            # sert dist/ sur :4173
npm run check                                 # 205 vérifications (socle + toutes les suites de module)

npm run build:auth && npm run preview:auth &  # sert dist-auth/ sur :4174
npm run check:auth                            # 217 : exige les DEUX serveurs
```

`check:auth` rejoue tout `check` puis ajoute le parcours avec comptes. C'est lui qui couvre le
chemin Supabase — à lancer dès qu'on touche à un store.

**Un échec est attendu le dimanche** : voir le journal, §8.

---

## 3. Architecture — état actuel et cible

### État actuel

**Étapes 1 à 5 du plan faites, et les étapes A et B de `docs/chantier-coquille-et-e2e.md` aussi.**
`src/data/` n'existe plus, le registre de modules existe, la sauvegarde est versionnée par
module, et **`App.tsx` est devenu la coquille du hub** : authentification, choix du module,
panneau de réglages, export/import de sauvegarde. Tout l'écran de Zénith (hub interne, objectifs,
historique, trophées, célébrations) vit maintenant dans
`modules/objectifs/ZenithScreen.tsx`. Les vérifications de bout en bout sont découpées à
l'identique : `e2e/run.mjs` (lanceur + socle : PWA, service worker, écran d'authentification) et
`src/modules/objectifs/e2e/suite.mjs` (tout Zénith). **Le socle est prêt à recevoir Astra.**

Deux décisions ont été prises avec Jules pour cette extraction (voir le journal) : l'écran
d'accueil du hub liste les modules en cartes (`ModulePicker`, plutôt qu'une barre d'onglets
permanente), et les réglages restent une fenêtre commune, mais chaque module y ajoute sa propre
section via `AtlasModule.SettingsSection` (Zénith y a mis « Objectif du jour » et le rappel).

Les deux étapes du chantier `docs/chantier-coquille-et-e2e.md` sont faites.

```
e2e/
  run.mjs             lanceur : navigateur, check(), découverte des suites de module
  core.mjs            suite du socle : PWA, service worker, écran d'authentification
src/
  App.tsx            coquille du hub : authentification, choix du module, réglages,
                     export/import. Un seul import de module (`Landing`, écran
                     public — voir §4, renommage reporté). Ne connaît aucun domaine.
  main.tsx
  styles.css         58 lignes — uniquement des @import, plus aucune règle
  modules/index.ts   ⭐ le registre : la liste des modules actifs
  core/
    components/      AuthScreen, PasswordRecovery, ReminderSettings, SettingsPanel,
                     ModulePicker (écran d'accueil du hub)
    lib/module.ts    ⭐ ce qu'un module déclare au hub (id, label, data, Screen,
                     SettingsSection…)
    data/
      backup.ts         sauvegarde versionnée, pilotée par le registre
      coreStore.ts      contrat du socle : comptes, réglages, notifications
      localCore.ts      implémentation navigateur
      supabaseCore.ts   implémentation Supabase
      localSnapshot.ts  le blob `palier.v1`, lu et écrit par section
      supabaseClient.ts client unique + helpers partagés
      index.ts          bascule locale/Supabase ; seul lecteur des variables d'env
    lib/             types (AppUser), push, sound, confetti, onboarding
    styles/          12 fichiers — socle commun (+ hub.css : écran d'accueil du hub)
  modules/objectifs/
    module.ts             ⭐ sa déclaration : id `objectifs`, label « Zénith »,
                          Screen, SettingsSection
    ZenithScreen.tsx      ⭐ tout l'écran du module — hub interne, objectifs,
                          historique, trophées, célébrations, file hors-ligne
    ZenithSettingsSection.tsx  sa section dans le panneau de réglages
    e2e/suite.mjs     ⭐ sa suite de bout en bout — grille, échelle, cérémonies,
                      comptage, quotidien, historique, rendu mobile (198 vérifications)
    components/      17 composants — Hub, GoalCard, Heatmap, Ceremony, Landing…
    data/
      goalsStore.ts     contrat du module + GoalsBackup
      localGoals.ts, supabaseGoals.ts, index.ts
      outbox.ts         file d'attente hors-ligne (encore propre au domaine)
      sync.ts           vidage de la file à la reconnexion
    lib/             ranks, progress, streak, counters, templates, types… + tests
    styles/          11 fichiers — style propre au module
supabase/
  schema.sql         tables de base + politiques RLS
  migration-N-*.sql  migrations numérotées séquentiellement
  functions/         Edge Functions (envoi des rappels)
docs/                études, maquettes, notes de sprint
```

### Ajouter un module

1. `src/modules/<nom-technique>/` — `module.ts`, `components/`, `data/`, `lib/`, `styles.css`.
2. Son contrat de stockage et ses **deux** implémentations, locale et Supabase.
3. Une ligne dans `src/modules/index.ts`.
4. Un `@import` **à la fin** de `src/styles.css`.
5. Ses tables, préfixées, avec RLS, dans une migration `AAAA-MM-JJ-sujet.sql`.

Aucun fichier du socle n'est modifié en chemin. Si tu te retrouves à en éditer un, c'est le
signe qu'une pièce appartient au socle et devrait y être remontée.

### Le garde-fou : `src/modules/conventions.test.ts`

Ces règles ne sont pas seulement écrites ici, elles sont **vérifiées à chaque `npm run test`**.
Une convention qu'aucun test ne contrôle ne survit pas à trois agents : elle est lue, comprise
à moitié, puis contournée par commodité.

Le test parcourt `src/modules/*` et exige de chacun : un `module.ts` dont l'`id` égale le nom
du dossier, une inscription au registre, un contrat de stockage avec ses **deux**
implémentations, un dossier `styles/` importé depuis `styles.css`, au moins un test unitaire,
une suite de bout en bout, des classes CSS préfixées, et **aucun import venant d'un autre
module**. Il vérifie aussi que le socle n'importe jamais depuis un module et que `styles.css`
ne contient que des `@import`.

**Ce fichier est la version exécutable du présent document.** Quand une règle change, elle
change aux deux endroits — sinon l'un des deux ment.

Deux mécanismes y rendent la dette visible plutôt que tacite :

- les listes `LEGACY` nomment les modules antérieurs à une règle. **Un nouveau module n'y
  entre jamais** : elles ne peuvent que se vider ;
- `PLAFOND_IMPORTS_MODULE_DANS_APP` empêche `App.tsx` de se coupler davantage aux modules
  qu'aujourd'hui. On peut l'abaisser en extrayant du code, jamais l'augmenter. Objectif : 0.

### Ce qui reste à faire

Le plan complet est décrit dans **`docs/architecture-modules.md`**. Lis-le avant tout travail
structurel, et vérifie l'arborescence réelle avant d'écrire un chemin.

### La règle qui tient tout : les contrats de stockage

`core/data/coreStore.ts` et `modules/<module>/data/<module>Store.ts` sont les **seuls** points
de contact entre l'interface et le stockage. Aucun composant ne connaît Supabase ni
`localStorage`. C'est ce qui permet à l'app de tourner sans compte en local et de basculer en
multi-utilisateur avec deux variables d'environnement.

**Un module apporte son contrat et ses deux implémentations ; il ne touche à aucun fichier du
socle.** C'est tout l'intérêt de la scission : ajouter Astra ne fera grossir aucun fichier
existant.

**Le sens des dépendances est à sens unique.** Un module importe depuis `core/` ; `core/`
n'importe jamais depuis un module. Si tu as besoin de l'inverse, c'est que le type ou la
fonction concernée appartient au socle — remonte-la, comme `AppUser` l'a été.

**Cette propriété ne doit jamais être cassée.** Un `import { createClient } from
'@supabase/supabase-js'` dans un composant est un défaut à corriger, pas un raccourci.

Corollaire : **toute méthode ajoutée à un contrat de stockage doit être implémentée dans les
deux implémentations**, locale et Supabase. Une seule des deux = mode local cassé.

---

## 4. Nommer — la règle et le piège

### Nom technique ≠ nom affiché

Le **nom technique** d'un module est descriptif, en minuscules, sans accent : `objectifs`,
`budget`. Il sert au dossier, à l'identifiant, aux préfixes de tables et de classes CSS.

Le **nom affiché** est la marque, et ne vit **qu'à un seul endroit** : le champ `label` de la
déclaration du module.

```ts
export const objectifsModule: AtlasModule = {
  id: 'objectifs',      // technique — jamais renommé pour des raisons de marque
  label: 'Zénith',      // affiché — le seul endroit à changer si le nom évolue
  …
};
```

Sans cette séparation, rebaptiser un module entraîne un renommage de dossiers, de classes CSS
et de tables — c'est-à-dire une migration de base de données pour une décision de vocabulaire.

### Ce que le renommage Zénith → Atlas touche, et ne touche pas

**À changer** (le nom y désigne l'application entière) : `package.json`, `index.html` (titre,
`apple-mobile-web-app-title`, description), `public/manifest.webmanifest`, `README.md`,
l'en-tête de `App.tsx`, et les mentions de marque des écrans publics `Landing.tsx` et
`AuthScreen.tsx`.

**À ne surtout pas changer** — ce sont des **clés de stockage**, et les renommer efface
silencieusement les données existantes :

| Clé | Fichier | Ce qu'on perdrait |
|---|---|---|
| `zenith.outbox.v1` | `data/outbox.ts` | **les coches en attente d'envoi** — le bug impardonnable |
| `palier.v1` | `data/localStore.ts` | toutes les données du mode local |
| `zenith.onboarded*` | `lib/onboarding.ts` | l'onboarding se rejoue à chaque ouverture |
| `zenith.catchup.ignores` | `lib/catchup.ts` | les rattrapages déjà écartés reviennent |
| `zenith.muted` | `lib/sound.ts` | le réglage du son |
| `zenith-v2` (cache) | `public/sw.js` | rien de grave, mais aucun gain |

`palier.v1` porte d'ailleurs encore le nom du tout premier prototype : la preuve qu'une clé de
stockage se garde même quand le produit change de nom. **Une clé est un identifiant, pas un
libellé.** Les tags de notification (`zenith-rappel`) et le titre poussé par
`send-reminders/index.ts` peuvent évoluer, mais sans urgence.

---

## 5. Conventions

### Langue

Le code est en anglais (identifiants, types, noms de fichiers). **Les commentaires, la
documentation et l'interface sont en français.** Les commentaires expliquent *pourquoi*, pas
*quoi* — le style existant dans `src/lib/types.ts` est la référence : quand une décision est
contre-intuitive, elle est justifiée en toutes lettres.

### Base de données

- Toute table porte `user_id uuid not null references auth.users (id) on delete cascade`.
- **Row Level Security activé sur toute table sans exception**, avec les quatre politiques
  nommées `<table>_select_own`, `<table>_insert_own`, `<table>_update_own`,
  `<table>_delete_own`. Copier le motif de `supabase/schema.sql`.
- Index sur `user_id` (et sur la colonne de tri quand il y en a une).
- Les tables d'un module sont préfixées par son **nom technique** : `budget_transactions`,
  `budget_categories`. Les tables du module objectifs gardent leurs noms historiques
  (`goals`, `tiers`, `actions`, `checkins`, `achievements`) — voir §4 : on ne renomme pas une
  table pour une raison de vocabulaire.
- Les scripts sont **idempotents** : `create table if not exists`, `drop policy if exists`
  avant `create policy`. On doit pouvoir tout rejouer sans casse.

### Migrations — nommage par date, plus par numéro

Les migrations existantes vont de `migration-2-*` à `migration-10-*`. **Ne pas continuer cette
numérotation.** Deux conversations parallèles produiraient chacune une `migration-11`
différente.

Nouvelle convention : `AAAA-MM-JJ-sujet.sql`, par exemple
`2026-08-09-budget-tables.sql`. Les anciennes ne sont pas renommées.

### Cohérence TypeScript ↔ SQL

Une contrainte `CHECK` en base qui énumère des valeurs doit avoir son pendant TypeScript
déclaré **en tableau `as const`**, et un test qui compare les deux. Ce n'est pas de la
paranoïa : la divergence s'est déjà produite (`compte` présent côté TS, absent du CHECK), le
code compilait, les tests passaient, et toute création d'objectif concernée était refusée par
Postgres. Voir `TIER_KINDS` dans `src/lib/types.ts` et `src/lib/schema.test.ts`.

### Style

Un module ne touche pas au style d'un autre module. Les classes CSS d'un module sont
préfixées par son nom technique (`.budget-…`). Les variables partagées (couleurs, espacements,
typographie) vivent dans `core/styles/base.css` et nulle part ailleurs.

**`src/styles.css` n'ordonne que des `@import`, et cet ordre est celui de l'ancien fichier
monolithique.** En CSS, deux règles de même spécificité se départagent par leur position :
réordonner ces imports change l'apparence de l'app sans toucher une seule règle. Un nouveau
module ajoute son import **à la fin**, jamais au milieu.

Les fichiers du découpage initial contiennent encore, ici et là, des règles qui appartiennent
à l'autre camp — la découpe a été faite par tranches contiguës pour garantir une cascade
identique, pas par tri sémantique. Déplacer une règle isolée d'un fichier à l'autre est permis,
mais c'est un changement à vérifier à l'œil, pas un simple rangement.

---

## 6. Points sensibles à ne pas casser

- **File d'attente hors-ligne** (`modules/objectifs/data/outbox.ts` et `sync.ts`). Une coche
  prise sans réseau est mise de côté et rejouée. Règle : une *erreur réseau* interrompt le
  vidage et garde la suite ; une *erreur serveur* retire l'opération, qui ne réussira jamais
  et bloquerait la file. ⚠ Elle est encore **écrite pour le domaine objectifs** (ses
  opérations parlent de check-ins). Le jour où Astra devra écrire en mobilité, il faudra la
  généraliser dans `core/` plutôt que la dupliquer — la clé `zenith.outbox.v1`, elle, ne
  bouge pas.
- **Variables d'environnement Vite = variables de *build*.** Elles sont figées dans le
  JavaScript à la compilation. Sur Cloudflare, elles vont dans *Settings → Build*, pas dans
  *Settings → Variables and Secrets*. Mal placées, le build réussit et le site déployé
  retombe silencieusement en mode local.
- **Les PP sont figés à l'enregistrement** dans les check-ins. Renommer ou revaloriser une
  action ne réécrit pas l'historique.
- **Le rang d'un objectif est celui du palier le plus élevé**, pas du dernier validé.
- **La sauvegarde suit le registre.** Un module déclaré dans `src/modules/index.ts` entre
  automatiquement dans le fichier, sous son nom technique : rien à modifier dans `backup.ts`
  ni dans `App.tsx`. En revanche, **un module absent du registre est un module dont les
  données sont perdues le jour d'une restauration.** Le format écrit est la v5
  (`{version, settings, modules:{…}}`) ; les fichiers à plat antérieurs restent lisibles, via
  le `fromLegacyBackup` de chaque module — c'est au module de savoir lire son ancien format,
  le socle ignore le nom de ses champs.
- **`.env` n'est jamais commité** (déjà couvert par `.gitignore`). La clé `anon` est publique
  par conception ; c'est le RLS qui protège, jamais le secret de cette clé.

---

## 7. Travailler à plusieurs conversations

Le projet avance sur plusieurs conversations Cowork successives, sans mémoire partagée. D'où
ces règles :

1. **Une seule conversation à la fois sur ce dépôt.** Des conversations différentes ne posent
   aucun problème ; des conversations *simultanées* s'écrasent mutuellement, en particulier
   sur les fichiers partagés et les migrations.
2. **Une branche git par chantier**, fusionnée quand `npm run test` et `npm run check`
   passent.
3. **Commit à la fin de chaque session.** Une session qui se termine sans commit laisse le
   dépôt dans un état que la suivante ne saura pas interpréter.
4. **Mettre à jour le journal ci-dessous** dès qu'une décision d'architecture est prise, un
   invariant ajouté, ou une convention modifiée. C'est le seul mécanisme de mémoire entre
   sessions — s'il n'est pas tenu, il ne sert à rien.

### En début de session

Lire ce fichier, puis `docs/architecture-modules.md` si le travail est structurel. Vérifier
l'état réel du dépôt (`git status`, arborescence) avant de faire confiance à une
documentation : elle peut avoir pris du retard.

### En fin de session

Tests verts → journal mis à jour → commit.

### Si la session tourne dans le nuage (Cowork « dans le cloud »)

Le dossier est alors atteint par un pont, depuis une VM Linux, et trois choses coincent :

1. **`node_modules` est installé pour macOS.** `npm run test`, `build` et `check` échouent sur
   un module natif introuvable (`@rollup/rollup-darwin-arm64`), et la VM n'a pas de réseau
   pour installer les binaires Linux. **Ne réinstalle pas les dépendances dans le dossier
   monté** : ça casserait l'installation locale. Copie le projet (sans `node_modules`, `.git`
   ni `dist`) dans le conteneur de la session, fais-y `npm ci`, et lance les vérifications
   là-bas. Puis compare les empreintes des fichiers source de part et d'autre pour t'assurer
   que ce qui a été testé est bien ce qui a été livré.
2. **Rien ne peut être supprimé** dans le dossier monté. Pour retirer un fichier, le déplacer
   dans un dossier `_to_delete/` à la racine et le signaler à Jules, qui le videra.
3. **Chaque commande git y laisse un verrou** (`.git/index.lock`) qu'elle ne peut pas
   effacer. Déplacer les `.git/*.lock` dans `_to_delete/` après chaque commit, sinon git
   finira par refuser de travailler.

Une session lancée « sur votre ordinateur » n'a aucun de ces trois problèmes.

---

## 8. Journal des décisions

Le plus récent en haut. Une ligne par décision, avec sa raison.

| 2026-08-31 | Deux améliorations UX d'Astra, étudiées avant d'être codées (demande explicite de Jules) : (1) le bouton « + Nouvelle écriture »/« + Nouvelle catégorie » (`.budget-add`) passe en `position: sticky`, ancré en bas du viewport, plutôt qu'à sa position naturelle en fin de liste — il fallait scroller jusqu'au bout d'un mois chargé ou de la vingtaine de catégories de départ pour l'atteindre ; (2) trouver la bonne catégorie dans `EntryEditor` : le menu est groupé par nature (`<optgroup>`, `CATEGORY_KIND_LABELS` factorisé), une suggestion se pré-sélectionne d'après les règles d'import déjà existantes dès que le libellé tapé matche l'une d'elles (`matchRule`, exporté de `boursobankImport.ts`, réutilisé tel quel), et les catégories les plus utilisées s'affichent en pastilles au-dessus du menu (`mostUsedCategoryIds`, sur l'historique complet, pas seulement le mois en cours) | Le sticky est le premier élément de ce type dans Atlas — choisi après avoir noté que même le « + Objectif » de Zénith, dans la barre du haut, défile avec le reste (aucun `position: sticky` nulle part dans le socle) : il évite le problème seulement parce qu'il est *avant* la liste, pas parce qu'il reste ancré à l'écran. La suggestion par mots-clés ne s'applique qu'à une **nouvelle** écriture, et seulement tant que l'utilisateur n'a pas lui-même choisi une catégorie (`categoryTouched`) : modifier une écriture existante, ou avoir déjà cliqué une pastille, ne doit jamais voir sa catégorie silencieusement réécrite pendant qu'on corrige le libellé — piège trouvé en écrivant le test e2e lui-même (un premier essai cliquait une pastille puis testait la suggestion, qui ne pouvait plus se déclencher par construction). Les pastilles fréquentes ne filtrent pas par nature de l'écriture (dépense/entrée) : un remboursement peut légitimement pointer vers une catégorie de dépense, filtrer aurait caché ce cas plutôt que de le servir. `473/473` tests unitaires → `477/477` (+4, `lib/categoryPicker.test.ts` — `matchRule` reste couvert par les tests existants de l'import, jamais dupliqués), `373/373` local → `383/383` (+10 : bouton visible en scrollant, menu groupé, pastilles, suggestion, non-écrasement manuel, immuabilité en édition), `385/385` en mode comptes → `395/395` (+10) |
| 2026-08-31 | Rendu mobile d'Orbite vérifié et corrigé (`docs/etude-flashcards.md` §16) — jamais fait jusqu'ici, contrairement à Zénith et Astra. Deux bugs trouvés : la barre du haut (trois boutons depuis l'ajout des statistiques) débordait sous 760px, et les lignes de paquet/carte/archive débordaient sous 480px, faute de repli | Le débordement de la barre du haut suit exactement le mécanisme déjà documenté le 24/08/2026 pour Zénith (`.main` du socle sans largeur explicite sur mobile) — jamais déclenché avant côté Astra ou Zénith parce qu'aucune de leurs barres du haut n'avait dépassé deux boutons. Corrigé en reprenant le motif déjà établi par Zénith (`.topbar-settings`) : texte caché sous 760px, icône seule, avec un `aria-label` explicite sur chaque `<button>` — sans lui, un bouton dont le texte est masqué (`display:none`) et l'icône exclue (`aria-hidden`) n'a plus de nom accessible du tout, ce qui a cassé le premier essai. Les lignes (`.flashcards-row`) reprennent le motif déjà utilisé par Astra (`.budget-entry-row`) : les actions repassent sur leur propre ligne sous 480px plutôt que de forcer un défilement horizontal. Un bug sans rapport découvert en chemin : un test comparait une date locale (`dayString()`) à une date UTC (`toISOString()`), qui ont divergé le jour où le calendrier a changé pendant la session — corrigé pour comparer les deux avec la même fonction. `473/473` tests unitaires (inchangé, correctif de test à part), `365/365` local → `373/373` (+8), `377/377` en mode comptes → `385/385` (+8) |
| 2026-08-30 | Import en masse ajouté à Orbite (`docs/etude-flashcards.md` §15) — dernier morceau demandé de l'étape 7, l'outbox jugée pas nécessaire pour l'instant et le rappel dédié non demandé. `lib/bulkImport.ts` (`parseBulkImport`, `withoutDuplicates`) + écran `BulkImport` accessible depuis un paquet, vide ou non : coller une liste plutôt que créer les cartes une par une | Format volontairement permissif : une carte par ligne, séparateur point-virgule **ou** tabulation (le premier trouvé dans la ligne), pour accepter aussi bien un texte tapé à la main qu'un collage de tableur, sans réglage à choisir. Aperçu avant écriture comme l'import CSV d'Astra — nouvelles cartes, lignes incomprises listées (pas juste comptées), doublons du paquet écartés (même recto, casse et espaces ignorés) plutôt que dupliqués. La détection de doublon ne regarde que le paquet où on importe, pas les autres : deux paquets peuvent légitimement vouloir la même carte. Toutes les cartes importées naissent en boîte 1, comme une création à l'unité — aucune méthode de stockage nouvelle, `BulkImport` appelle `createCard` en boucle. `465/465` tests unitaires → `473/473` (+8 : `lib/bulkImport.test.ts`), `359/359` local → `365/365` (+6 : aperçu, import effectif, doublon écarté), `371/371` en mode comptes → `377/377` (+6). Étape 7 close pour ce qui a été demandé ; rien d'autre n'est en attente dans le découpage d'origine |
| 2026-08-30 | Étape 6 d'Orbite livrée, **sans streak** (`docs/etude-flashcards.md` §14) : table `flashcards_reviews` (journal des révisions), `reviewCard` qui l'écrit en plus de `box`/`dueDay`, panneau **Statistiques** (`StatsPanel`) — total de révisions, sept derniers jours, taux de réussite. Streak délibérément écarté : Jules a fait remarquer que la file du jour d'Orbite dépend de l'algorithme, pas de la discipline de l'utilisateur (contrairement à Zénith, où une action est toujours disponible) — un streak punirait un jour où il n'y avait justement rien à réviser. Bug corrigé au passage : `onBack` de `DeckDetail` ne rafraîchissait pas l'écran principal, qui restait figé sur son état d'avant l'ouverture du paquet (bandeau, pastilles, répartition par boîte, désormais aussi les statistiques) | `correct` est un paramètre explicite de `reviewCard`, jamais déduit de `patch.box === 1` — ce serait vrai aujourd'hui (une réponse fausse est la seule façon d'atteindre la boîte 1) mais ferait fuiter la règle du Leitner dans un contrat qui n'est pas censé la connaître. Suppression en cascade du journal : supprimer une carte ou un paquet emporte les révisions qui s'y rattachent, en local comme côté base (`on delete cascade`) — pas d'entrée de journal orpheline. Le bug de rafraîchissement n'avait touché aucune vérification jusqu'ici parce qu'aucune n'enchaînait une vraie révision suivie d'un retour à l'écran principal ; celle des statistiques l'a fait apparaître immédiatement. `457/457` tests unitaires → `465/465` (+8 : `lib/stats.test.ts` 4, `localFlashcards.test.ts` +3 pour le journal, `schema.test.ts` +1 pour la contrainte de boîte du journal), `356/356` local → `359/359` (+3 : panneau vide, révision reflétée, aucune erreur JS), `368/368` en mode comptes → `371/371` (+3) |
| 2026-08-30 | La répartition par boîte d'Orbite (voir l'entrée précédente) remontée sur l'écran principal, agrégée sur tous les paquets actifs (`docs/etude-flashcards.md` §13, section ajoutée) : mêmes pastilles « Boîte 1 (n) »… choisir une boîte déplie ses cartes, chacune étiquetée du paquet dont elle vient, cliquable pour l'ouvrir. Demande de Jules : « on ne voit que les boîtes pour un paquet en particulier », et la voir « comme dans un paquet particulier au final » sur l'écran principal | `boxDistribution` calculée sur `reviewableCards` (paquets actifs seulement, même périmètre que le bandeau « Aujourd'hui » — un paquet archivé ne compte pas). Le filtre s'ajoute au-dessus de la liste des paquets, il ne la remplace jamais : la gestion des paquets (archiver, supprimer…) reste toujours atteignable, même une boîte ouverte. Cliquer une carte de cette liste globale appelle `setOpenDeck`, la même navigation que cliquer un paquet — aucune nouvelle façon d'entrer dans un paquet, juste un point d'entrée de plus. `457/457` tests unitaires (inchangé), `350/350` local → `356/356` (+6 : agrégation à travers deux paquets, liste repliée par défaut, étiquette de provenance, navigation vers le paquet propriétaire), `362/362` en mode comptes → `368/368` (+6) |
| 2026-08-30 | Visibilité par boîte ajoutée à Orbite, post-V1 (`docs/etude-flashcards.md` §13) : chaque carte affiche sa boîte en points (`BoxDots`, ●●●○○), et un filtre par boîte (avec l'effectif de chacune) montre le contenu de la boîte 1, 2, etc. sur demande. Fragment de l'étape 6 (répartition par boîte) tiré en avant — le streak et l'historique, qui ont besoin de `flashcards_reviews`, restent pour l'étape 6 complète. Demande de Jules : « on ne sait pas quelle carte est bientôt finie » | `boxDistribution` (lib/boxes.ts) existait déjà depuis l'étape 4 et n'a pas bougé — seul un écran manquait par-dessus. Le filtre reprend le motif du filtre par action de `Heatmap` (Zénith) sans en réutiliser le code, comme toujours entre modules. Créer une carte réinitialise le filtre à « Toutes » : une carte neuve naît en boîte 1, rester sur un autre filtre la rendrait invisible sans explication. `457/457` tests unitaires (inchangé, aucune règle pure nouvelle), `344/344` local → `350/350` (+6 : répartition affichée, points par carte, filtrage, boîte vide, retour à « Toutes »), `356/356` en mode comptes → `362/362` (+6) |
| 2026-08-30 | Visibilité du jour ajoutée à Orbite, post-V1 (`docs/etude-flashcards.md` §12) : un bandeau « Aujourd'hui » en tête de l'écran des paquets annonce le nombre total de cartes dues et ouvre une session tous paquets confondus ; chaque paquet porte en plus sa propre pastille d'échéance. Demande de Jules : savoir tout de suite quoi réviser, sans ouvrir chaque paquet un par un | `ReviewSession` généralisée : elle prend un `title` (nom d'un paquet, ou « Aujourd'hui ») plutôt qu'un `Deck`, et un `decks?: Deck[]` optionnel pour étiqueter la provenance de chaque carte quand la file mélange plusieurs paquets — absent pour une session propre à `DeckDetail`, où le titre suffit déjà. Aucune méthode de stockage nouvelle : `FlashcardsScreen` appelle `listCards()` (déjà là) une fois pour tout le module, et filtre par paquet actif côté client, exactement comme `DeckDetail` le fait déjà pour un seul. Le bandeau ne se cache jamais à zéro due : « Tout est à jour » remplace le bouton plutôt que de faire disparaître la zone, pour que la question du jour ait toujours une réponse visible — bonne ou pas. Le bouton « Retour au paquet » de fin de session devient « Terminer », neutre, correct dans les deux contextes. `457/457` tests unitaires (inchangé, aucune nouvelle règle pure : le bandeau ne fait qu'agréger `dueCards`, déjà testé à l'étape 4), `336/336` local → `344/344` (+8 : bandeau, pastilles par paquet, session tous paquets, étiquette de provenance, retour à l'état à jour), `348/348` en mode comptes → `356/356` (+8) |
| 2026-08-30 | Étape 5 d'Orbite livrée (`docs/etude-flashcards.md` §9), **« la V1 est atteinte »** : l'écran de révision (`ReviewSession`), accessible depuis un paquet via un bouton « Réviser (N) » qui n'apparaît que si des cartes sont dues. Une carte à la fois, recto puis verso au clic, puis Juste/Faux ; la session se termine sur un récapitulatif quand la file est épuisée. Le contrat `FlashcardsStore` gagne `reviewCard(id, { box, dueDay })`, implémentée dans les deux modes | `reviewCard` est délibérément une méthode à part de `updateCard` : elle est la seule à pouvoir changer `box`/`dueDay`, et ne prend en paramètre que l'état déjà calculé — elle ne connaît pas la règle du Leitner, exactement comme `updateCategory` ne recalcule jamais un solde. C'est l'écran (`ReviewSession`) qui appelle `applyReview` (lib/boxes.ts, étape 4) puis passe son résultat tel quel. La file d'une session est figée à l'ouverture (`dueCards(...).slice(0, SESSION_LIMIT)`) : elle ne grandit pas si une carte devient due pendant la session, pour une progression prévisible. Aucun paquet ne montre encore la boîte d'une carte dans sa liste (§6 : « aucune notion de boîte n'apparaît encore à l'écran ») — volontairement laissé à l'écran de statistiques, étape 6, pour ne pas préempter sa conception. `457/457` tests unitaires (inchangé : `ReviewSession` n'ajoute aucune règle propre, elle appelle `applyReview` déjà testé à l'étape 4), `330/330` local → `336/336` (+6 : bouton Réviser, recto/verso, progression, fin de session, carte revue quitte la file du jour), `342/342` en mode comptes → `348/348` (+6) |
| 2026-08-30 | Étape 4 d'Orbite livrée (`docs/etude-flashcards.md` §9) : le moteur du système de Leitner (`lib/boxes.ts`) — `dueCards`, `applyReview`, `boxDistribution` — bibliothèque pure, sans écran. « La règle est correcte avant d'être affichée » | Deux constantes distinctes portent l'échelle : `BOX_INTERVALS = [1, 2, 4, 8, 16]` pour l'intervalle à l'entrée de chaque boîte, et `MASTERED_INTERVAL = 32` pour une carte qui *reste* en boîte 5 après y être déjà arrivée — sans cette deuxième constante, une carte maîtrisée continuerait indéfiniment sur l'intervalle de 16 jours de son arrivée, ce qui n'aurait rien de faux mais ne correspondrait pas à l'échelle décidée avec Jules (§11 : « 1, 2, 4, 8, 16 puis 32 jours en boîte 5 »). Rétrogradation dure confirmée : `applyReview` ignore la boîte de départ sur une réponse fausse, retombe toujours en boîte 1 — un seul test paramétré le vérifie pour les cinq boîtes de départ plutôt que cinq tests recopiés. `dueCards` trie les cartes dues par échéance puis par boîte (les plus en retard et les plus fragiles d'abord) ; le plafond de 50 cartes par session (§11 Q6) n'est volontairement pas appliqué ici — c'est une décision d'écran (étape 5), pas une vérité sur ce qui est dû, et l'écran de statistiques (étape 6) a besoin du vrai compte, non plafonné. `shiftDay` rejoint `dayString` dans `lib/day.ts`, copié depuis `objectifs/lib/catchup.ts` pour la même raison qu'à l'étape 1 (aucun module n'importe d'un autre). Rien de neuf côté écran : aucune régression possible, `330/330` local et `342/342` en mode comptes inchangés. `444/444` tests unitaires → `457/457` (+13, `lib/boxes.test.ts`, chaque cas de §5 de l'étude explicitement couvert) |
| 2026-08-30 | Étape 3 d'Orbite livrée (`docs/etude-flashcards.md` §9) : le contenu d'un paquet — cliquer un paquet ouvre `DeckDetail`, qui liste ses cartes (recto/verso) et permet d'en créer, éditer, supprimer (`CardEditor`). « Le contenu existe » | Aucune nouvelle méthode de stockage : `listCards`/`createCard`/`updateCard`/`deleteCard` existaient déjà depuis l'étape 1, cette étape n'est que l'écran par-dessus — `DeckDetail` filtre `listCards()` côté client par `deckId`, pas de nouvelle méthode `listCardsByDeck` sur le contrat, le volume attendu par paquet ne le justifie pas. Aucune notion de boîte n'apparaît encore à l'écran : le moteur de révision (étape 4) n'existe pas, une carte neuve est simplement listée, pas encore due ni classée. La ligne d'un paquet dans la liste (étape 2) devient cliquable pour l'ouvrir ; ses boutons Modifier/Archiver/Supprimer stoppent la propagation du clic pour ne pas ouvrir le paquet par erreur en les actionnant. `444/444` tests unitaires (inchangé, aucune nouvelle logique pure : `DeckDetail`/`CardEditor` ne font qu'appeler le contrat déjà testé), `322/322` local → `330/330` (+8 : ouverture d'un paquet, écran vide, création/édition/suppression d'une carte, persistance après un aller-retour), `334/334` en mode comptes → `342/342` (+8) |
| 2026-08-30 | Étape 2 d'Orbite livrée (`docs/etude-flashcards.md` §9) : écran des paquets — création, renommage, archivage/restauration, suppression (`FlashcardsScreen` + `DeckEditor`) | Un paquet archivé (`archived: true`) quitte la liste active mais garde ses cartes, restaurable — même mécanique que les objectifs de Zénith, mais sans reprendre son code : un module n'importe jamais d'un autre, les classes (`.flashcards-archived…`) et la logique (`activeDecks`/`archivedDecks` filtrés dans le composant) sont réécrites, sobrement, comme `SavingsChart` l'a été pour Astra plutôt que réutiliser `PPChart`. Supprimer un paquet reste possible qu'il soit actif ou archivé (`deleteDeck`, déjà écrit à l'étape 1, cascade sur les cartes côté base) — pas de geste à deux temps « archiver puis supprimer » imposé. Aucune carte gérée à ce stade : l'écran ne fait que ranger des paquets vides, la étape 3 leur donne un contenu. `444/444` tests unitaires (inchangé, aucune nouvelle logique pure : la suppression/l'archivage passent par les méthodes déjà testées de `LocalFlashcards`), `313/313` local → `322/322` (+9 : la suite e2e de l'étape 1, 4 vérifications sur le seul signet, est remplacée par 13 vérifications sur le vrai écran), `325/325` en mode comptes → `334/334` (+9) |
| 2026-08-30 | Troisième module créé : `flashcards` (nom affiché **Orbite**), révision par répétition espacée avec un système de Leitner. Étude complète dans `docs/etude-flashcards.md`, six décisions tranchées avec Jules le 30/08/2026 (§11) : nom du module, rétrogradation **dure** sur une réponse fausse (retour systématique en boîte 1), **5 boîtes** avec les intervalles `1, 2, 4, 8, 16` jours puis 32 en boîte 5, généralisation de l'outbox hors ligne **différée**, gamification (PP/rangs) **à revoir plus tard**, session de révision plafonnée à **50 cartes** (constante fixe, pas encore un réglage). Étape 1 du découpage (§9) livrée dans la foulée : migration `2026-08-30-flashcards-tables.sql` (`flashcards_decks`, `flashcards_cards`, RLS complet), contrat `FlashcardsStore` + `LocalFlashcards` + `SupabaseFlashcards`, `module.ts` avec un écran signet, inscription au registre, `styles/placeholder.css`, et les tests requis par `conventions.test.ts` | `box` et `dueDay` sont stockés directement sur la carte, jamais recalculés depuis un historique de révisions — à la différence des enveloppes d'épargne d'Astra, parce que le système de Leitner est fondamentalement à état (la boîte EST l'état de la carte, comme `completedAt` sur un palier de Zénith), et que rejouer tout l'historique de chaque carte à chaque affichage d'un paquet serait coûteux pour un faible bénéfice. Éditer une carte (`updateCard`) ne touche jamais `box`/`dueDay` : seule une révision les change, une fois le moteur écrit (étape 4). `BOX_COUNT = 5` vit en TypeScript et un test (`lib/schema.test.ts`) le compare à la contrainte `flashcards_cards_box_check` de la migration — même discipline que `TIER_KINDS`. `dayString()` est dupliquée depuis `objectifs/lib/streak.ts` plutôt qu'importée (aucun module n'importe d'un autre) ; la table `flashcards_reviews` (journal des révisions, pour les statistiques) est différée à l'étape 6, rien dans les deux premières tables n'en dépend. `428/428` tests unitaires → `444/444` (+16 : `localFlashcards.test.ts` 6, `schema.test.ts` 1, `conventions.test.ts` 22 → 31 pour le nouveau module), `309/309` local → `313/313` (+4 : carte du module, signet, retour), `321/321` en mode comptes → `325/325` (+4) |
| 2026-08-25 | Astra prend plus de largeur sur grand écran (`.budget-main`, 1440px contre 1080px pour `.main` du socle) : le camembert et sa légende laissaient toute la largeur gagnée en vide (retour de Jules après le premier passage à deux colonnes) | Classe ajoutée par-dessus `.main` plutôt qu'un changement du socle — importée après lui dans `styles.css`, elle l'emporte à spécificité égale sans toucher `core/styles/base.css` ; Zénith garde sa largeur de lecture inchangée. La légende du camembert (`.budget-pie-legend`) passe de largeur minimale à `flex: 1` pour occuper l'espace gagné. Aucun test ne couvre une largeur d'écran précise (les vérifications de largeur existantes ciblent le mobile) — vérifié à l'œil via une capture d'écran à 1800px. `370/370` unit, `276/276` local, `288/288` en mode comptes, tous inchangés (CSS pur) |
| 2026-08-25 | Trois retouches à l'onglet Aperçu suite aux remarques de Jules après la V1 : (1) un deuxième camembert « Entrées » à côté de celui des dépenses, plus trois chiffres côte à côte (Dépensé, Entré, Solde) — `computeMonthlyBreakdown` gagne `incomeSlices`/`totalIncomeCents`, même construction symétrique que les dépenses ; (2) les deux camemberts sont côte à côte sur écran large plutôt qu'un seul centré, pour ne plus laisser la moitié de l'écran vide ; (3) ordre des onglets : Épargne en deuxième position, Catégories en dernier | `PieChart` gagne un `variant` (`'expense'`/`'income'`) pour afficher le bon signe sans dupliquer le composant. Le solde utilise ses propres classes CSS (`.budget-month-stat-net.positive/.negative`) plutôt que réutiliser celles de Dépensé/Entré (`.expense`/`.income`), qui marquent une nature fixe alors que le solde change de couleur selon son signe. `366/366` unit → `370/370` (+4 : entrées, remboursement au-delà de la dépense, transfert/epargne exclus des deux camemberts), `273/273` local → `276/276` (+3), `285/285` en mode comptes → `288/288` (+3) |
| 2026-08-25 | Courbe d'évolution du total mis de côté ajoutée à l'onglet Épargne (`SavingsChart`) — idée initialement écartée du chantier (§6), demandée par Jules une fois les trois étapes livrées. `lib/envelopes.ts` gagne `computeSavingsTimeline`, qui cumule les écritures `epargne` jour par jour | Construction propre à Astra plutôt que réutilisée depuis `objectifs/components/PPChart.tsx` (même forme de courbe) : un module n'importe jamais depuis un autre. Le cadre du graphique suit un total qui peut devenir négatif (plus retiré que mis de côté), sans qu'aucun calcul existant n'ait besoin de changer. `361/361` unit → `366/366` (+5), `271/271` local → `273/273` (+2), `283/283` en mode comptes → `285/285` (+2) |
| 2026-08-25 | Chantier enveloppes d'épargne, étape 3 (dernière) livrée : bouton « Historique » par enveloppe (`EnvelopeHistory`) — la liste de ses mouvements, le plus récent en premier, avec suppression individuelle | Solde et non-affecté se recalculent automatiquement après une suppression, toujours pas stockés (§4.3). `361/361` unit (inchangé, pas de nouvelle logique de calcul), `271/271` local et `283/283` en mode comptes (+5 chacun) |
| 2026-08-25 | Chantier enveloppes d'épargne, étape 2 livrée : nouvel onglet « Épargne » (`EnvelopesScreen`) — total mis de côté, non-affecté (avec alerte si négatif), liste des enveloppes, création/édition (`EnvelopeEditor`), affectation/retrait de fonds (`EnvelopeMoveForm`). Calculs dans `lib/envelopes.ts` | Solde et non-affecté toujours recalculés, jamais stockés (§4.3). `GROUPS` de l'écran Catégories mis à jour pour afficher la nature `epargne` (sinon la catégorie de départ restait invisible). `361/361` unit (+10 `envelopes.test.ts`), `266/266` local et `278/278` en mode comptes (+10 vérifications Épargne chacun, plus l'ajustement du test « groupes de catégories » passé de 4 à 5) |
| 2026-08-25 | Chantier enveloppes d'épargne, étape 1 livrée : nouvelle nature de catégorie `epargne` (distincte de `transfert` — exclue du camembert comme lui, mais alimente en plus le total mis de côté), tables `budget_envelopes` et `budget_envelope_moves` (migration `2026-08-25-budget-envelopes.sql`), contrat `BudgetStore` étendu (`listEnvelopes`/`createEnvelope`/`updateEnvelope`/`deleteEnvelope`, `listEnvelopeMoves`/`createEnvelopeMove`/`deleteEnvelopeMove`) et ses deux implémentations, catégorie de départ `Épargne` reclassée en `epargne`. Aucun écran encore — conception complète dans `docs/etude-astra-epargne.md`, sept questions tranchées avec Jules le 25/08/2026 | Le solde d'une enveloppe n'est **jamais stocké**, seulement recalculé en sommant `budget_envelope_moves` — même principe que le total du mois, jamais mis en cache, qui ne peut donc pas diverger. Le non-affecté (total épargné moins la somme de tous les mouvements) n'a pas de colonne non plus : l'invariant « la somme des enveloppes égale le total » tient par construction, jamais par une contrainte à vérifier. Supprimer une enveloppe (`on delete cascade` sur `envelope_id`) renvoie mécaniquement ses fonds au non-affecté, sans mouvement compensatoire à écrire — décision §7 Q5 de l'étude. Aucun lien entre `budget_envelope_moves` et `budget_entries` : lier une dépense à une enveloppe (le cas de la vidange) reste un geste manuel à deux temps (une dépense normale + un retrait d'enveloppe avec une note), justement pour ne jamais exiger un vrai virement bancaire à chaque fois — voir §6 bis de l'étude, qui répond à l'objection soulevée par Jules sur la cohérence avec son compte réel. Retirer de l'argent de l'épargne ne demande aucune fonctionnalité de plus : une écriture positive catégorisée `epargne` fait mécaniquement baisser le total, symétrique à un dépôt (signe déjà porté par `amountCents` partout dans Astra). `schema.test.ts` du module bascule sur le même mécanisme « dernière définition de contrainte fait foi » que `modules/objectifs/lib/schema.test.ts`, Astra ayant désormais deux migrations. `343/343` tests unitaires → `351/351` (+8 : enveloppes et mouvements dans `localBudget.test.ts`, exclusion `epargne` du camembert, hygiène de migration), `255/255` local et `267/267` en mode comptes inchangés (aucun écran nouveau à vérifier à ce stade) |
| 2026-08-24 | Bug rapporté par l'utilisateur, touchant Astra **et** Zénith indifféremment : l'app ramenait parfois toute seule à l'écran de choix des modules. Cause, dans `App.tsx` (socle) : l'effet qui remet à zéro l'écran affiché dépendait de l'objet `user` entier plutôt que de son identifiant. En mode Supabase, `onUserChange` (`supabaseCore.ts`) rappelle son callback à chaque événement `onAuthStateChange` — y compris un `TOKEN_REFRESHED` sans rapport avec un changement de compte, que Supabase déclenche entre autres à la reprise de focus d'un onglet ou de l'app — et reconstruit à chaque fois un nouvel objet `AppUser`, distinct par référence même à contenu identique. React rejouait donc cet effet à chaque retour sur l'app, qui remettait `moduleId` à `null`. Corrigé en ne dépendant que de `user?.id` | **Exception documentée** : `App.tsx` est un fichier du socle, hors limites pour ce chantier — corrigé ici comme les deux précédentes fois (`core/styles/mobile.css`, `core/styles/hub.css`) parce qu'il s'agit d'un bug concret signalé, avec un correctif strictement ciblé (une dépendance de `useEffect`, aucun comportement changé en dehors du cas de ré-émission). Le bug touchait les deux modules par construction : `moduleId` est un état du hub, pas d'un module, et aucun des deux n'avait de moyen de s'en prémunir depuis son propre code. `343/343` tests unitaires, `255/255` local, `267/267` en mode comptes, tous inchangés (correctif de dépendance React, sans nouveau comportement observable dans une session e2e courte et sans jeton à rafraîchir) |
| 2026-08-24 | Bug rapporté après coup sur étape 5 : changer d'onglet pendant ou après un import réinitialisait tout (aperçu en cours, catégories déjà choisies, case « créer une règle », confirmation finale). Cause : `ImportScreen` était démonté à chaque changement d'onglet (rendu conditionnel dans `BudgetScreen.tsx`), perdant son état local — contrairement à Catégories, qui n'est pas un composant à part et garde son état dans `BudgetScreen` lui-même. Corrigé en gardant `ImportScreen` toujours monté, simplement masqué (`hidden`) en dehors de l'onglet Importer, plutôt que retiré du DOM | Aperçu et Catégories, eux, se remontent volontairement à chaque visite (Aperçu recharge les écritures pour refléter un import tout juste validé, voir `MonthScreen.tsx`) : seul Import porte un travail en cours qui n'a de source de vérité nulle part ailleurs tant que « Valider » n'a pas été cliqué — c'est spécifiquement ce cas qui devait survivre à un changement d'onglet, pas les deux autres écrans. `343/343` tests unitaires (inchangé, correctif de montage React sans nouvelle logique testable unitairement), `253/253` local → `255/255` (+2 : l'aperçu et le choix de catégorie survivent à un aller-retour d'onglet, la confirmation aussi), `265/265` en mode comptes → `267/267` (+2) |
| 2026-08-24 | Étape 5 d'Astra livrée, **dernière étape du plan** (`docs/etude-astra.md` §7) : import du relevé BoursoBank en CSV (`lib/boursobankImport.ts`, `lib/csv.ts`), aperçu avant écriture (`ImportScreen.tsx`, nouvel onglet « Importer »), dédoublonnage par empreinte `(jour, libellé brut, montant, rang d'occurrence)` et catégorisation automatique amorcée par sept des onze `categoryParent` documentés (`docs/astra-import-boursobank.md` §3) | **Aucune migration SQL** : le schéma posé à l'étape 1 anticipait déjà l'index unique partiel `(user_id, import_key)` et la table `budget_rules`. **Catégorisation volontairement incomplète** : trois `categoryParent` documentés (« Auto & Moto », « Virements émis », « Virements reçus ») restent « à classer » plutôt que de deviner un nom de catégorie approché — deviner ferait courir exactement le risque que §3 met en garde contre, confondre un virement ordinaire avec un virement interne (qui, lui, doit être exclu du camembert). Un clic classe la ligne, et cocher « créer une règle » à ce moment-là suffit à ce que le mois suivant se range tout seul — une règle utilisateur l'emporte toujours sur l'amorce. **`label` vs `displayLabel`** : le nom affiché par BoursoBank (`suggestedLabel`) est stocké comme `label` de l'écriture, quand il existe ; le libellé brut, lui, ne sert qu'à l'empreinte de dédoublonnage et n'est jamais persisté à part — pas de colonne supplémentaire nécessaire. Le filet de sécurité final contre un doublon (l'unicité `(user_id, import_key)` côté base) reste couvert par un filtrage côté client avant écriture, pas par l'inspection du code d'erreur Postgres — `unwrap()` (`core/data/supabaseClient.ts`) ne préserve que le message, jamais le code structuré. `306/306` tests unitaires → `343/343` (+37 : `lib/csv.test.ts` 8, `lib/boursobankImport.test.ts` 22, 7 nouveaux cas dans `lib/amount.test.ts` pour `parseSignedAmountToCents`), `245/245` local → `253/253` (+8 : dépôt du fichier, compte des nouvelles/déjà-connues/à-classer, doublon volontaire du relevé compté deux fois, classement manuel + règle, réimport sans duplication), `257/257` en mode comptes → `265/265` (+8) |
| 2026-08-24 | Quatre correctifs Astra rapportés par l'utilisateur après coup sur étape 4 : (1) l'adresse e-mail est masquée sur téléphone dans l'en-tête du hub (`core/styles/mobile.css`) plutôt que simplement autorisée à passer à la ligne — l'en-tête tenait sur deux lignes, ce qui restait moche ; (2) cause racine du (petit) débordement horizontal restant, y compris dans l'onglet Catégories : `.main` (socle, `core/styles/mobile.css`) ne portait pas de `width: 100%` sur mobile — un item flex seul dans un conteneur flex en colonne peut, dans certains cas, se calculer plus large que son parent sans cette valeur explicite ; reproduit avec Playwright (393px de large mesurés pour un `.main` dans un viewport à 375px) puis corrigé ; (3) les onglets d'Astra sont réordonnés — « Aperçu » (l'ancien « Mois », renommé — il dit maintenant ce qu'il fait plutôt que ce qu'il montre) passe en premier et devient l'onglet par défaut, « Catégories » en second ; (4) sur le camembert, le contour blanc de sélection disparaissait parfois sur un des côtés d'une part — chaque `<path>` de part dessinait sa propre bordure sur les côtés partagés avec ses voisines, et celle dessinée en dernier dans le DOM l'emportait visuellement ; corrigé en redessinant la part sélectionnée par-dessus toutes les autres, en contour seul (`PieChart.tsx`) | Les points (1) et (2) touchent `core/styles/mobile.css`, un fichier du socle — même exception que la veille : bug concret signalé, correctif strictement ciblé. Le point (3) change le comportement de persistance de session : après un rechargement, Astra retombe désormais sur Aperçu et non plus sur la dernière catégorie éditée, ce qui a demandé d'ajuster la suite e2e (recliquer sur Catégories après un rechargement pour vérifier la persistance des catégories). `306/306` tests unitaires (inchangé, correctifs CSS/UI sans nouvelle logique testable unitairement), `245/245` local (+4 : onglet par défaut, écran vide de Catégories, persistance de l'onglet après rechargement, contour de sélection redessiné en dernier), `257/257` en mode comptes (+4) |
| 2026-08-24 | Correction du défilement horizontal sur téléphone à deux endroits : la liste des opérations d'Astra (`budget/styles/placeholder.css`) et l'écran d'accueil du hub (`core/styles/hub.css`) | Rapporté par l'utilisateur. Dans Astra, une ligne d'écriture porte cinq colonnes à largeurs fixes (jour, pastille, libellé, montant, actions) dont la somme dépasse la largeur d'un téléphone étroit ; le jour et les actions repassent sur leur propre ligne en dessous de 520px plutôt que d'être comprimés. Sur l'écran d'accueil, une adresse e-mail longue et sans espace dans `.hub-picker-actions` ne rétrécissait ni ne passait à la ligne, poussant tout l'écran au-delà du viewport ; `flex-wrap` et `overflow-wrap: anywhere` corrigent ça sans rien changer d'autre. **Exception documentée** : `core/styles/hub.css` est un fichier du socle, normalement hors limites pour ce chantier — corrigé ici parce qu'il s'agit d'un bug concret signalé, avec un correctif CSS strictement additif (aucune classe renommée, aucun comportement changé en dehors du cas de débordement). Vérifié à la main avec Playwright à 320px et 375px de large (le défilement horizontal mesurable disparaît : `scrollWidth` ≈ `clientWidth`) faute de pouvoir reproduire une vraie session Supabase connectée dans cette session cloud ; `306/306` tests unitaires, `241/241` local, `253/253` en mode comptes, tous inchangés (correctif CSS pur) |

| Date | Décision | Pourquoi |
|---|---|---|
| 2026-08-23 | Étape 4 d'Astra livrée, « la V1 est atteinte » : l'onglet « Opérations » de l'étape 3 devient l'onglet « Mois » (`MonthScreen`) — sélecteur de mois (`lib/month.ts`), total dépensé, camembert SVG dessiné à la main (`PieChart.tsx`, comme `objectifs/components/PPChart.tsx` pour sa courbe) et calculé par `lib/monthlyBreakdown.ts`, avec la liste des opérations (`EntriesView`, désormais alimentée par son parent plutôt que de charger elle-même) toujours sous le camembert (`docs/etude-astra.md` §5). Cliquer une part filtre la liste ; recliquer retire le filtre | Quatrième des cinq chantiers de `docs/etude-astra.md` §7. Deux règles du camembert sont explicites dans l'étude : les catégories `kind = transfert` en sont exclues (§2/§6), et une écriture dépensée sans catégorie doit y apparaître sous « À classer » plutôt que disparaître du total (§2). Une troisième règle est **une interprétation, pas une exigence du texte** : seuls les groupes au net **négatif** sur le mois deviennent une part. Ce choix exclut naturellement les catégories `revenu` (le salaire) et les catégories entièrement remboursées, sans écrire de cas particulier sur `kind` — le signe du net suffit, dans le droit fil du remboursement décrit en §6 (« la catégorie totalise alors 40 € de moins »). Il respecte aussi la garantie du §2 : une dépense non catégorisée ne disparaît jamais du total, seule une *entrée d'argent* isolée et non catégorisée (ex. un remboursement d'ami sans rien en face) peut ne pas faire de part, ce qui est cohérent puisqu'elle n'est justement pas une dépense. Le camembert agrège par catégorie, donc par « pas de catégorie » pour « à classer » : une dépense et une entrée non catégorisées se nettent ensemble, pas séparément — le test e2e le vérifie explicitement (30 € de dépense + 20 € de remboursement = 10 € de part « à classer »). Onglet par défaut resté « Catégories », pas « Mois » : à la toute première visite, sans aucune catégorie, c'est encore l'écran de création qui doit apparaître en premier — le camembert n'aurait rien à montrer avant. Aucune migration SQL pour cette étape : le camembert est un calcul côté client sur les tables existantes. `288/288` unit → `306/306` (+18 : `lib/month.test.ts` et `lib/monthlyBreakdown.test.ts`), `241/241` local (+12), `253/253` en mode comptes (+12) |
| 2026-08-23 | Étape 3 d'Astra livrée : saisie manuelle (`EntryEditor`) et liste des opérations (`EntriesView`), sous un nouvel onglet « Opérations » à côté de « Catégories » (`BudgetScreen`) ; montant lu en euros positifs + bascule Dépense/Entrée plutôt que de faire taper un signe, converti sans flottant (`lib/amount.ts`) | Troisième des cinq chantiers de `docs/etude-astra.md` §7 : « le module devient utilisable seul ». Le signe porte le sens d'un remboursement (une entrée positive dans une catégorie de dépense) sans champ `type` séparé — voir `docs/etude-astra.md` §2 et §6. Une écriture sans catégorie reste visible sous « à classer », jamais masquée |
| 2026-08-23 | Étape 2 d'Astra livrée : écran des catégories (`BudgetScreen` + `CategoryEditor`) — création, édition (nom, emoji, couleur, nature), suppression, et un bouton « Charger les catégories de départ » qui pose les 21 catégories de `docs/etude-astra.md` §3 (`lib/starterCategories.ts`) | Deuxième des cinq chantiers de `docs/etude-astra.md` §7 : « on peut ranger ». Supprimer une catégorie ne supprime jamais les écritures qui pointaient dessus : elles redeviennent « à classer » (`categoryId: null`), comme le prévoit `LocalBudget.deleteCategory`/`SupabaseBudget.importData` depuis l'étape 1 — sans ça une catégorie supprimée par erreur emporterait son historique |
| 2026-08-23 | La suite e2e de Zénith (`modules/objectifs/e2e/suite.mjs`) passe désormais par la carte du hub avant de continuer (`gotoZenith`/`reloadZenith`, remplaçant tout `goto`/`reload` direct) | Conséquence directe de l'arrivée d'un deuxième module dans le registre : `ModulePicker` s'affiche maintenant pour de vrai sur toute page fraîchement chargée (le court-circuit à un seul module dans `App.tsx` ne s'applique plus). Sans cet ajustement, les 198 vérifications de Zénith échouaient toutes en timeout sur `.onboarding-card` — la suite d'un module ne doit rien connaître d'un autre, mais elle doit encaisser le comportement du hub commun. `205/205` puis `209/209` (+4 pour Astra étape 1), `217/217` puis `221/221` en mode comptes |
| 2026-08-23 | Étape 1 d'Astra livrée : migration `supabase/2026-08-23-budget-tables.sql` (`budget_categories`, `budget_entries`, `budget_rules`, RLS complet), contrat `BudgetStore` + `LocalBudget` + `SupabaseBudget`, `module.ts` avec un écran signet (`BudgetScreen`), inscription au registre, `styles/placeholder.css`, et les tests requis par `conventions.test.ts` — dont celui qui compare les CHECK SQL (`budget_categories_kind_check`, `budget_entries_source_check`) aux tableaux `as const` de `lib/types.ts` | Premier des cinq chantiers de `docs/etude-astra.md` §7 : « le module existe, vide, et passe `conventions.test.ts` ». Montants stockés en centimes entiers signés (jamais en flottant), `category_id` nullable à dessein (« à classer », jamais masqué), et un index unique partiel sur `(user_id, import_key)` pour que réimporter un relevé ne duplique jamais une ligne — la conception complète est dans `docs/etude-astra.md` |
| 2026-08-23 | Étape B du chantier de la coquille faite : `e2e-check.mjs` (1973 lignes) découpé en `e2e/run.mjs` (lanceur, découvre les suites de module par scan de `src/modules/*/e2e/suite.mjs`), `e2e/core.mjs` (socle : PWA, service worker, écran d'auth — 7 + 12 vérifications) et `src/modules/objectifs/e2e/suite.mjs` (Zénith — 198 vérifications) | Ordre imposé par le chantier : la coquille d'abord (étape A), les suites e2e ensuite. `205/205` puis `217/217` après découpage, identiques aux chiffres d'avant — extraction ligne à ligne vérifiée par sous-chaîne exacte, aucun contrôle perdu |
| 2026-08-23 | La section « Réglages » de l'ancien fichier (ouverture du panneau, rythme quotidien, absence de rappel en local) rejoint la suite `objectifs`, pas `core.mjs` | Aujourd'hui, atteindre les réglages passe forcément par l'écran de Zénith — décision pragmatique, à revoir si un jour les réglages s'ouvrent aussi sans aucun module actif |
| 2026-08-23 | `LEGACY.sansSuiteE2E` supprimé de `conventions.test.ts` (la liste s'est vidée) ; `LEGACY.sansPrefixeCSS` reste, lui, non vide | Le chantier le demandait explicitement : « si la liste se vide, supprimer la liste » — mais seule celle-là s'est vidée, l'autre dette (préfixe CSS) n'est pas concernée par l'étape B |
| 2026-08-23 | « Changer de module » ajouté dans le panneau de réglages (`SettingsPanel`), câblé directement depuis `App.tsx` | Le bouton « ▲ Modules » du pied de la barre latérale (`ZenithScreen`) est invisible sur téléphone — `mobile.css` cache tout `.sidebar-foot` pour laisser la place à la barre du bas. Le panneau de réglages, lui, reste joignable partout via `.topbar-settings`, jamais caché par cette règle |
| 2026-08-09 | Étape A du chantier de la coquille faite : `App.tsx` réduit à authentification + choix du module + réglages + export/import ; tout l'écran de Zénith déplacé dans `modules/objectifs/ZenithScreen.tsx` | Deux agents travaillant chacun sur un module ne doivent plus se croiser sur `App.tsx` |
| 2026-08-09 | Hub : écran d'accueil listant les modules en cartes (`ModulePicker`), pas une barre d'onglets permanente | Choix de Jules — plus clair pour un premier module qui grossit, une barre coûterait de la hauteur d'écran sur mobile |
| 2026-08-09 | Avec un seul module enregistré, le hub y entre directement sans passer par l'écran de choix | Sinon toutes les vérifications de bout en bout (205 + 217) auraient dû cliquer une carte supplémentaire pour rien — l'écran de choix ne prend son sens qu'à partir de deux modules |
| 2026-08-09 | Réglages : fenêtre commune (compte, données) + une section par module via `AtlasModule.SettingsSection` | Choix de Jules — « Objectif du jour » et le rappel n'ont de sens que pour Zénith, mais une fenêtre unique reste plus simple qu'un onglet par module tant qu'il n'y en a qu'un avec des réglages |
| 2026-08-09 | `AtlasModule` gagne `Screen` (écran racine) et `SettingsSection` (optionnelle) ; `ModuleScreenProps` porte `user`, `settings`, `error`, `onError`, `onOpenSettings`, `onBackToHub`, `reloadToken` | Le hub doit pouvoir rendre l'écran d'un module et lui donner la main sur les réglages et l'erreur globale, sans connaître son contenu |
| 2026-08-09 | `Landing` reste le seul import de module dans `App.tsx` (plafond abaissé de 22 à 1, pas à 0) | Écran public de marque, dont le renommage est déjà reporté par ailleurs (§4) ; le forcer dans le contrat `AtlasModule` maintenant aurait anticipé une décision qui n'est pas encore prise |
| 2026-08-09 | Le md5 du CSS produit a changé (`57f11ca6…` → `fe2ec1c8…`) lors de l'étape A | Contrairement aux découpages précédents, cette étape ajoute du CSS neuf (écran d'accueil du hub, intitulé de section de réglages) — ce n'est pas un déplacement pur, donc pas une régression |
| 2026-08-09 | Les conventions entre modules sont **vérifiées par un test**, pas seulement écrites | Trois agents sans mémoire partagée ne tiennent pas une règle qui ne casse rien quand on l'enfreint |
| 2026-08-09 | La dette est **nommée** (listes `LEGACY`, plafond d'imports) plutôt que tacite | Une exemption visible se résorbe ; une exception silencieuse devient la norme |
| 2026-08-09 | Astra s'alimentera par **import du relevé CSV**, jamais par synchro bancaire | Les API DSP2 sont fermées aux particuliers (agrément + certificat eIDAS à 2 000–10 000 €/an) et les intermédiaires gratuits ont fermé. Voir `docs/etude-budget-solutions.md` |
| 2026-08-09 | Le renommage des surfaces publiques (titre, manifeste, page d'accueil) est **reporté** | Tant qu'Atlas n'a qu'un module, afficher « Atlas » à la place de « Zénith » n'apprendrait rien à personne. À faire quand Astra rend le hub visible |
| 2026-08-09 | Sauvegarde v5 : une section par module, sous son nom technique | Le format à plat promouvait les champs d'un seul module au rang de format d'échange |
| 2026-08-09 | C'est au module de relire son ancien format (`fromLegacyBackup`) | Le socle n'a pas à connaître le vocabulaire de chaque domaine |
| 2026-08-09 | Le registre `src/modules/index.ts` est le seul fichier partagé qu'un module modifie | Deux conversations ajoutant chacune un module n'ont qu'une ligne à départager |
| 2026-08-09 | `Store` scindé en `CoreStore` + `GoalsStore`, deux implémentations chacun | Le contrat unique aurait doublé de taille à chaque module, et les deux implémentations avec lui |
| 2026-08-09 | Le blob local `palier.v1` est lu et écrit **par section** | Le socle ne connaît que `settings` ; sans lecture-modification-écriture il écraserait les sections des modules |
| 2026-08-09 | Un client Supabase unique, partagé (`core/data/supabaseClient.ts`) | Un `createClient` par module ferait diverger l'état d'authentification entre eux |
| 2026-08-09 | La sauvegarde est assemblée dans `App.tsx`, pas dans un store | C'est le seul endroit qui connaît tous les modules — en attendant le registre de l'étape 4 |
| 2026-08-09 | Un contrôle e2e (« Rien n'est dessiné avant la création de l'objectif ») échoue **tous les dimanches** | La grille finit le dimanche de la semaine en cours : ce jour-là il n'existe aucune case hors période. Antérieur au découpage, à corriger à part |
| 2026-08-09 | `AppUser` remonte dans `core/lib/types.ts` | C'est un type du socle ; le laisser côté objectifs forçait un composant de `core/` à importer depuis un module |
| 2026-08-09 | Le dossier d'un module porte son **nom technique** (`modules/objectifs/`), jamais sa marque | `modules/zenith/`, créé par erreur à l'étape 1, contredisait la règle qu'il venait d'illustrer |
| 2026-08-09 | `styles.css` découpé par tranches contiguës, ordre des `@import` figé | Une découpe sémantique aurait réordonné la cascade ; ici la concaténation redonne l'original à l'octet près (md5 vérifié) |
| 2026-08-09 | Les clés de stockage (`zenith.outbox.v1`, `palier.v1`…) ne suivent **pas** le renommage | Une clé est un identifiant, pas un libellé : la renommer efface les données des utilisateurs existants |
| 2026-08-09 | Nom technique (`objectifs`) séparé du nom affiché (`Zénith`) | Pour qu'un changement de marque ne devienne jamais une migration de base |
| 2026-08-09 | Le module budget s'appelle **Astra** | Famille céleste cohérente avec Zénith, sous le hub Atlas |
| 2026-08-09 | Le hub s'appelle **Atlas** ; **Zénith** devient le nom du module objectifs | L'app ne se confond plus avec son premier domaine |
| 2026-08-09 | Migrations nommées par date, plus par numéro séquentiel | Deux conversations parallèles créaient deux `migration-11` différentes |
| 2026-08-09 | Atlas devient un hub multi-modules ; budget = deuxième module | Réutiliser un socle gratuit, hébergé et testé plutôt que repartir de zéro |
| 2026-08-09 | Création de ce fichier | Les conversations Cowork ne partagent aucune mémoire ; les conventions se perdaient d'une session à l'autre |

---

## 9. Documentation à jour ou périmée

À lire avant de construire **Astra** : `docs/etude-budget-solutions.md` (pourquoi un module
plutôt qu'une app ou un tableur, et pourquoi l'import CSV plutôt que la synchro bancaire) puis
`docs/architecture-modules.md` §5 (le modèle de données envisagé).

`docs/` contient des études de fond (habitudes, paliers comptables, quotidien, gamification)
qui restent valables, et des notes de sprint qui **ont vieilli** : `docs/prochains-sprints.md`
décrit comme « à faire » des chantiers désormais livrés (rappels push, quantités, file
hors-ligne, tests du cœur métier, mot de passe oublié). Le README annonce 17 vérifications
e2e, les notes en annoncent 81, et le fichier a encore grossi depuis. Ces documents parlent
tous de « Zénith » au sens de l'application entière : c'est le sens historique, pas une erreur
à corriger partout.

**Ne jamais déduire l'état du projet d'un document sans le vérifier dans le code.** Quand tu
constates un écart, corrige le document dans la foulée.
