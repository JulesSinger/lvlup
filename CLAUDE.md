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

### Lancer les vérifications de bout en bout

**`npm run check` ne démarre aucun serveur** : il attend que le build soit déjà servi. Oublier
cette étape produit un `net::ERR_CONNECTION_REFUSED` qui ressemble à un bug de l'app.

```bash
npm run build && npm run preview &            # sert dist/ sur :4173
npm run check                                 # ~223 vérifications

npm run build:auth && npm run preview:auth &  # sert dist-auth/ sur :4174
npm run check:auth                            # 235 : exige les DEUX serveurs
```

`check:auth` rejoue tout `check` puis ajoute le parcours avec comptes. C'est lui qui couvre le
chemin Supabase — à lancer dès qu'on touche à un store.

Tout doit passer, tous les jours de la semaine — l'échec du dimanche est corrigé
(journal, §8).

---

## 3. Architecture — état actuel et cible

### État actuel

**Étapes 1 à 5 du plan faites.** `src/data/` n'existe plus, le registre de modules existe, et
la sauvegarde est versionnée par module. **Le socle est prêt à recevoir Astra.**

Reste un chantier de l'étape 4 qui n'a pas été fait : `App.tsx` porte encore tout l'écran du
module objectifs et devrait se réduire à une coquille (authentification + navigation entre
modules). Ce n'est pas bloquant pour créer Astra, mais ce sera le prochain point de collision
entre conversations dès qu'il y aura deux modules à afficher.

```
src/
  App.tsx            ~40 Ko — coquille, célébrations, trophées, et encore tout
                     l'écran du module objectifs (à extraire — voir ci-dessus)
  main.tsx
  styles.css         56 lignes — uniquement des @import, plus aucune règle
  modules/index.ts   ⭐ le registre : la liste des modules actifs
  core/
    components/      AuthScreen, PasswordRecovery, ReminderSettings, SettingsPanel
    lib/module.ts    ⭐ ce qu'un module déclare au hub (id, label, data…)
    data/
      backup.ts         sauvegarde versionnée, pilotée par le registre
      coreStore.ts      contrat du socle : comptes, réglages, notifications
      localCore.ts      implémentation navigateur
      supabaseCore.ts   implémentation Supabase
      localSnapshot.ts  le blob `palier.v1`, lu et écrit par section
      supabaseClient.ts client unique + helpers partagés
      index.ts          bascule locale/Supabase ; seul lecteur des variables d'env
    lib/             types (AppUser), push, sound, confetti, onboarding
    styles/          11 fichiers — socle commun
  modules/objectifs/
    module.ts        ⭐ sa déclaration : id `objectifs`, label « Zénith »
    components/      18 composants — Hub, GoalCard, Heatmap, Ceremony, Landing…
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
| `zenith.outbox.v1` | `modules/objectifs/data/outbox.ts` | **les coches en attente d'envoi** — le bug impardonnable |
| `palier.v1` | `core/data/localSnapshot.ts` | toutes les données du mode local |
| `zenith.onboarded*` | `core/lib/onboarding.ts` | l'onboarding se rejoue à chaque ouverture |
| `zenith.catchup.ignores` | `modules/objectifs/lib/catchup.ts` | les rattrapages déjà écartés reviennent |
| `zenith.muted` | `core/lib/sound.ts` | le réglage du son |
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
*quoi* — le style existant dans `src/modules/objectifs/lib/types.ts` est la référence : quand une décision est
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
Postgres. Voir `TIER_KINDS` dans `src/modules/objectifs/lib/types.ts` et `src/modules/objectifs/lib/schema.test.ts`.

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

| Date | Décision | Pourquoi |
|---|---|---|
| 2026-08-09 | Chaque bloc de `e2e-check.mjs` est enveloppé dans `section()` : un plantage coûte **une** vérification, plus le reste du fichier | Vérifié en sabotant un bloc : 213/214 avec une ligne d'échec nommée, au lieu d'un script mort à mi-parcours. C'est ce qui masquait la non-vérification du parcours avec comptes tous les dimanches |
| 2026-08-09 | Plus de liste de rangs au formulaire d'ajout de palier : le rang à venir est **annoncé**, pas demandé | Depuis que les rangs appartiennent aux barreaux, le choix affiché n'était plus honoré — on choisissait « Maître » et on obtenait « Challenger ». Une liste qui ment est pire que pas de liste ; le rang reste modifiable palier par palier |
| 2026-08-09 | Insérer un palier au milieu : les paliers du dessous glissent d'un barreau, l'étape prend le rang de sa place | Même règle que le déplacement — les rangs appartiennent aux barreaux. Refusé au-dessus d'un palier validé, dont le rang est un trophée daté |
| 2026-08-09 | Une échelle **jamais retouchée** reprend la suite standard de sa nouvelle longueur ; une échelle personnalisée, non | Sinon insérer dans une échelle qui touchait déjà Challenger donnait deux barreaux au même rang. Le garde-fou : dès qu'un rang a été choisi à la main, la convention ne s'applique plus |
| 2026-08-09 | L'invariant testé est « l'échelle ne descend jamais », pas « aucun palier n'est rétrogradé » | Le second est plus fort qu'il ne faut : une échelle qui s'allonge redistribue ses rangs, exactement comme si l'objectif avait été créé avec un palier de plus |
| 2026-08-09 | **La nature d'un objectif est déduite de ses paliers, jamais stockée** | Elle s'affiche et se change comme une propriété (« ces paliers se comptent en km »), mais un champ en base aurait créé deux sources de vérité qui se contredisent — un objectif annonçant « cumul en km » au-dessus de paliers comptant des jours. Comme le streak et la grille : recalculé, donc jamais désynchronisé, et vrai rétroactivement |
| 2026-08-09 | Un palier ajouté hérite de l'échelle ; sa cible se lit dans son intitulé | Règle mesurée sur les 66 paliers chiffrés de la bibliothèque : le premier nombre du titre est la cible, le mot qui suit est l'unité — juste 63 fois sur 66. Un test épingle le taux, et tombera si la règle ou la bibliothèque dérivent |
| 2026-08-09 | On ne devine **jamais** la nature d'un palier, seulement sa cible | « 30 pompes d'affilée » et « 30 séances » portent le même nombre et n'ont rien à voir. Le nombre est dans le titre, la nature n'y est pas : c'est elle qu'on demande une fois pour tout l'objectif |
| 2026-08-09 | `createGoal` accepte les actions de départ, qui portent l'unité de l'objectif | Sans ça, un palier « 100 km » créé à la main restait à **0/100 pour toujours** : les deux actions génériques naissent sans unité, donc une coche n'enregistre aucune quantité. Défaut vérifié, pas supposé |
| 2026-08-09 | « Série » reste hors du choix global de nature | C'est la nature où un jour manqué efface tout ; le projet la réserve au tabac et à l'alcool, et un test le vérifie. Elle reste accessible palier par palier |
| 2026-08-09 | **Les rangs appartiennent aux barreaux de l'échelle, pas aux paliers** : un déplacement échange aussi les rangs | `reorderTiers` ne réécrivait que les positions : ajouter un palier à la fin puis le remonter donnait « bronze, argent, challenger, or ». L'échelle descendait, en silence, sur le seul chemin offert pour insérer une étape au milieu |
| 2026-08-09 | Un palier **validé** ne se déplace plus, et rien ne se déplace à travers lui | Son rang est un trophée daté ; l'échange l'aurait réécrit. Refuser le geste vaut mieux que l'exécuter à moitié — la flèche est grisée et le dit |
| 2026-08-09 | Le recalcul systématique de toute l'échelle est **écarté** | Il aurait écrasé les rangs choisis à la main, liberté documentée dans `ranks.ts`. Corriger un bug en en créant un autre, plus sournois |
| 2026-08-09 | La réserve de gels ne survit **pas** à la rupture d'une série, et n'annonce jamais un gel déjà engagé | Le compteur était juste sauf dans la fenêtre où on le consulte ; et une réserve héritée amortissait en silence les premiers trous d'une habitude neuve — l'inverse de ce à quoi sert un gel |
| 2026-08-09 | L'échec e2e du dimanche est corrigé : le jeu d'essai fait naître un objectif **dans** la fenêtre | La vérification s'appuyait sur les jours à venir de la semaine en cours — inexistants le dimanche. Elle testait donc autre chose que son intitulé six jours sur sept |
| 2026-08-09 | Un élément absent doit faire tomber **une** ligne, jamais emporter la suite du fichier | `locator.evaluate()` sur un locator vide attend 30 s puis lève : le dimanche, tout ce qui suivait cette ligne — dont le parcours avec comptes — n'était pas vérifié du tout |
| 2026-08-09 | Astra s'alimentera par **import du relevé CSV**, jamais par synchro bancaire | Les API DSP2 sont fermées aux particuliers (agrément + certificat eIDAS à 2 000–10 000 €/an) et les intermédiaires gratuits ont fermé. Voir `docs/etude-budget-solutions.md` |
| 2026-08-09 | Le renommage des surfaces publiques (titre, manifeste, page d'accueil) est **reporté** | Tant qu'Atlas n'a qu'un module, afficher « Atlas » à la place de « Zénith » n'apprendrait rien à personne. À faire quand Astra rend le hub visible |
| 2026-08-09 | Sauvegarde v5 : une section par module, sous son nom technique | Le format à plat promouvait les champs d'un seul module au rang de format d'échange |
| 2026-08-09 | C'est au module de relire son ancien format (`fromLegacyBackup`) | Le socle n'a pas à connaître le vocabulaire de chaque domaine |
| 2026-08-09 | Le registre `src/modules/index.ts` est le seul fichier partagé qu'un module modifie | Deux conversations ajoutant chacune un module n'ont qu'une ligne à départager |
| 2026-08-09 | `Store` scindé en `CoreStore` + `GoalsStore`, deux implémentations chacun | Le contrat unique aurait doublé de taille à chaque module, et les deux implémentations avec lui |
| 2026-08-09 | Le blob local `palier.v1` est lu et écrit **par section** | Le socle ne connaît que `settings` ; sans lecture-modification-écriture il écraserait les sections des modules |
| 2026-08-09 | Un client Supabase unique, partagé (`core/data/supabaseClient.ts`) | Un `createClient` par module ferait diverger l'état d'authentification entre eux |
| 2026-08-09 | La sauvegarde est assemblée dans `App.tsx`, pas dans un store | C'est le seul endroit qui connaît tous les modules — en attendant le registre de l'étape 4 |
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
