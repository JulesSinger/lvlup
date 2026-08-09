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
| `budget` | **Astra** | dépenses, catégories, comparaison mensuelle | à construire |
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
| Tests bout en bout | Playwright, via `e2e-check.mjs` à la racine |
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

---

## 3. Architecture — état actuel et cible

### État actuel

**Étapes 1 et 2 du plan faites.** Le style, les composants et la logique métier sont répartis
entre `core/` et `modules/objectifs/`. **`src/data/` n'a pas bougé** : il porte encore le
contrat unique `Store`, qui mêle socle et domaine. Le scinder est l'étape 3 — le déplacer
avant aurait produit un `core/` qui dépend d'un module.

```
src/
  App.tsx            ~40 Ko — coquille + logique de célébration + trophées
  main.tsx
  styles.css         56 lignes — uniquement des @import, plus aucune règle
  core/
    components/      AuthScreen, PasswordRecovery, ReminderSettings, SettingsPanel
    lib/             types (AppUser), push, sound, confetti, onboarding
    styles/          11 fichiers — socle commun
  modules/objectifs/
    components/      18 composants — Hub, GoalCard, Heatmap, Ceremony, Landing…
    lib/             ranks, progress, streak, counters, templates, types… + tests
    styles/          11 fichiers — style propre au module
  data/              ⚠ transitoire — à scinder à l'étape 3
    store.ts         interface Store — contrat unique interface ↔ stockage
    localStore.ts    implémentation navigateur (localStorage)
    supabaseStore.ts implémentation Postgres + auth
    index.ts         choisit l'implémentation selon les variables d'env
    outbox.ts        file d'attente hors-ligne
    sync.ts          vidage de la file à la reconnexion
supabase/
  schema.sql         tables de base + politiques RLS
  migration-N-*.sql  migrations numérotées séquentiellement
  functions/         Edge Functions (envoi des rappels)
docs/                études, maquettes, notes de sprint
```

### Cible : `src/core/` + `src/modules/<module>/`

Le plan de découpage est décrit dans **`docs/architecture-modules.md`**. Lis-le avant tout
travail structurel.

**Tant que la migration n'est pas faite, `src/modules/` n'existe pas — ne le cherche pas et
n'invente pas de chemins.** Consulte l'arborescence réelle avant d'écrire.

### La règle qui tient tout : l'interface `Store`

`src/data/store.ts` est le **seul** point de contact entre l'interface et le stockage. Aucun
composant ne connaît Supabase ni `localStorage`. C'est ce qui permet à l'app de tourner sans
compte en local et de basculer en multi-utilisateur avec deux variables d'environnement.

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

- **File d'attente hors-ligne** (`data/outbox.ts`, `data/sync.ts`). Une coche prise sans
  réseau est mise de côté et rejouée. Règle : une *erreur réseau* interrompt le vidage et
  garde la suite ; une *erreur serveur* retire l'opération, qui ne réussira jamais et
  bloquerait la file. Toute écriture d'un nouveau module qui peut se faire en mobilité doit
  passer par cette file.
- **Variables d'environnement Vite = variables de *build*.** Elles sont figées dans le
  JavaScript à la compilation. Sur Cloudflare, elles vont dans *Settings → Build*, pas dans
  *Settings → Variables and Secrets*. Mal placées, le build réussit et le site déployé
  retombe silencieusement en mode local.
- **Les PP sont figés à l'enregistrement** dans les check-ins. Renommer ou revaloriser une
  action ne réécrit pas l'historique.
- **Le rang d'un objectif est celui du palier le plus élevé**, pas du dernier validé.
- **`exportAll` / `importAll` doivent couvrir tout nouveau module.** Un module absent de la
  sauvegarde est un module dont les données sont perdues le jour d'une restauration.
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

---

## 8. Journal des décisions

Le plus récent en haut. Une ligne par décision, avec sa raison.

| Date | Décision | Pourquoi |
|---|---|---|
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

`docs/` contient des études de fond (habitudes, paliers comptables, quotidien, gamification)
qui restent valables, et des notes de sprint qui **ont vieilli** : `docs/prochains-sprints.md`
décrit comme « à faire » des chantiers désormais livrés (rappels push, quantités, file
hors-ligne, tests du cœur métier, mot de passe oublié). Le README annonce 17 vérifications
e2e, les notes en annoncent 81, et le fichier a encore grossi depuis. Ces documents parlent
tous de « Zénith » au sens de l'application entière : c'est le sens historique, pas une erreur
à corriger partout.

**Ne jamais déduire l'état du projet d'un document sans le vérifier dans le code.** Quand tu
constates un écart, corrige le document dans la foulée.
