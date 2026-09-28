# Calendrier — étude du sixième module (et la question des tâches)

*Étude de conception, écrite avant le code — même exercice que `docs/etude-nutrition.md` et
`docs/etude-courses.md`. Objectif : voir ce que fait le marché, ce qu'un calendrier demande
vraiment techniquement, et surtout **ce que les autres modules d'Atlas peuvent lui apporter**.
Les décisions qui reviennent à Jules sont regroupées en fin de document (§11).*

Demande de Jules (26/09/2026) : « mettre des éléments sur toute une journée, sur certaines heures
de la journée, sur plusieurs jours ; plusieurs vues (jour, semaine, mois) ; événements récurrents
ou ponctuels ; des événements qui sont des tâches ? un lien avec un module de to-do list ? »

---

## 1. Ce qui existe déjà, et sur quoi ce module s'appuie

Comme les cinq modules précédents, celui-ci hérite gratuitement du socle : comptes, Row Level
Security, synchronisation entre appareils, sauvegarde par module, hébergement. Trois choses
comptent particulièrement ici :

- **Les rappels push existent déjà** (Web Push, clés VAPID, Edge Function `send-reminders`), et
  **pg_cron**, compris dans l'offre gratuite de Supabase, les déclenche déjà pour Zénith
  (`docs/rappels-mise-en-place.md`). Un rappel « 15 minutes avant un événement » n'est donc pas
  un chantier d'infrastructure, seulement une nouvelle fonction planifiée (§8).
- **Les services entre modules** (`core/lib/services.ts`), créés pour que Comète envoie ses
  courses à Astra, permettent à un module de rendre un service aux autres **sans les importer**.
  Le calendrier en est le cas d'école, dans l'autre sens : chaque module peut **exposer ses
  dates**, et le calendrier les affiche sans les posséder (§6).
- **La file hors ligne commune** (`core/data/outbox.ts`) est disponible si l'on veut noter un
  rendez-vous sans réseau.

**Ce qui est neuf dans le projet :** des **heures**. Jusqu'ici, tout Atlas raisonne en jours
(`dayString`) : un check-in, une dépense, une carte due, un repas, une course ont un jour, jamais
une heure. Un calendrier ajoute les heures, les durées, les chevauchements — et avec eux les
fuseaux horaires et les changements d'heure (§8).

---

## 2. Le marché

| Application | Point fort | Modèle (2026) | Ce qu'on en retient |
|---|---|---|---|
| **Google Calendar** | le standard : plusieurs calendriers, récurrence, partage | gratuit | la base attendue : jour, semaine, mois, récurrence, couleurs |
| **Calendrier et Rappels d'Apple** | déjà sur l'iPhone ; les rappels datés apparaissent dans le calendrier | gratuit | tâches et événements **séparés mais affichés ensemble** |
| **Fantastical** | saisie en langage naturel (« déj avec Paul jeudi 12h »), agrège plusieurs comptes | payant | la saisie rapide est ce qui fait gagner le plus de temps |
| **Notion Calendar** | épuré, raccourcis clavier | gratuit | la sobriété |
| **Morgen**, **Amie** | calendrier et tâches réunis, on **pose une tâche sur un créneau** (time-blocking) | payants au-delà des bases | la convergence tâches ↔ agenda |
| **TickTick**, **Todoist** | des listes de tâches avec une vue calendrier | gratuits avec limites | l'autre sens : partir des tâches |
| **Motion**, **Reclaim** | placent **automatiquement** les tâches dans l'agenda, par IA | payants | exclus (règle n°1) ; l'idée de planification peut rester manuelle |

**La tendance nette : tâches et calendrier convergent.** Soit les tâches datées s'affichent dans
le calendrier (Apple, Todoist), soit on glisse une tâche sur un créneau pour la bloquer (Morgen,
Amie, Sunsama). Aucune app ne mélange tout dans une seule liste : **une tâche et un événement
restent deux choses différentes**, affichées au même endroit.

**Ce qu'Atlas peut faire que les autres ne font pas :** montrer, dans le même calendrier, **ce que
les autres modules savent de chaque jour** — les objectifs cochés, les cartes à réviser, les
courses, les dépenses (§6). Aucune app du marché n'a accès à ces données-là.

---

## 3. Les briques d'un événement

| Forme | Exemple | Ce qu'il faut stocker |
|---|---|---|
| **Toute la journée** | « Anniversaire de Léa » | un jour, sans heure |
| **Plusieurs jours** | « Vacances à Lisbonne », du 12 au 19 | un jour de début et un jour de fin (inclus) |
| **À certaines heures** | « Dentiste », 14 h – 14 h 30 | un jour, une heure de début, une heure de fin |
| **À cheval sur minuit** | « Soirée », 21 h – 2 h | jour et heure de début, jour et heure de fin |

**La récurrence** suit le standard des calendriers, la **RRULE** (RFC 5545), dont on garde le
sous-ensemble utile : chaque jour, semaine, mois ou année ; tous les N ; certains jours de la
semaine (« lundi et jeudi ») ; jusqu'à une date ou un nombre de fois. Le 31 d'un mois qui n'en a
pas trente et un, le 29 février : des cas à trancher et à tester, pas à découvrir en production.

**Les exceptions sont la vraie difficulté.** « Le cours de sport tous les mardis, sauf le 14 » ;
« celui du 21 exceptionnellement à 19 h ». Toute app sérieuse propose, en modifiant une
occurrence, le choix **« cet événement seulement / tous les suivants / tous »**. Techniquement :
on ne stocke **jamais** les occurrences, seulement la règle et une liste d'exceptions (supprimer
une occurrence, ou en remplacer une) ; « tous les suivants » coupe la règle en deux.

**Autour :** une couleur ou une catégorie (perso, travail, sport…), un lieu, une note, et un ou
plusieurs rappels (§8).

---

## 4. Les vues

- **Mois** : une grille de semaines, les événements en pastilles, les plusieurs-jours en bandes.
- **Semaine** et **jour** : une grille horaire, les événements en blocs dont la hauteur est la
  durée ; ceux qui se chevauchent se partagent la largeur ; la journée entière en haut.
- **Agenda** (liste des prochains jours) : pas demandée, mais **la plus lisible sur téléphone**
  — c'est la vue par défaut de beaucoup d'apps mobiles. Recommandée en plus des trois autres.

**Écrire les vues ou utiliser FullCalendar ?**

| | FullCalendar | Vues écrites à la main |
|---|---|---|
| Licence | **MIT** pour les vues jour, semaine, mois, liste, et la récurrence ; seules les vues « ressources » (planning d'équipe) sont payantes, inutiles ici | — |
| Ce qu'on obtient | grille horaire, chevauchements, glisser-déposer, redimensionner, glisser pour créer un créneau | tout est à écrire |
| Coût | une dépendance lourde (à mesurer au build, chargée seulement dans le module), un style à adapter au thème d'Atlas | beaucoup de travail sur la grille horaire (disposition des chevauchements, gestes tactiles) |
| Précédent dans Atlas | Tiptap pour Orbite : une bibliothèque quand le fait-main coûte trop | les graphiques de Zénith, Astra, Cérès, Comète |

**Recommandation :** les vues **mois** et **agenda** sont simples à écrire à la main, dans le style
d'Atlas. La **grille horaire** (semaine, jour) avec glisser-déposer au doigt est exactement le
genre de chose qu'une bibliothèque fait mieux : **FullCalendar pour la semaine et le jour**, chargé
à la demande. Dans tous les cas, **la récurrence reste à nous** (§7) : c'est la règle métier, elle
doit être testée comme celles des autres modules.

---

## 5. Les tâches : trois options

| Option | Principe | Pour | Contre |
|---|---|---|---|
| **a. Une tâche est un événement cochable** | dans le calendrier, un événement peut être marqué « tâche » et coché | un seul module, simple | une tâche **sans date** (« rappeler le plombier ») n'a pas sa place dans un calendrier ; pas de vraie liste |
| **b. Un module de tâches à part** *(recommandé)* | une to-do list (listes, échéances, sous-tâches, priorités) ; ses tâches **datées** s'affichent dans le calendrier par un service | chaque module reste simple ; c'est ce que fait Apple ; le mécanisme de services existe déjà ; la to-do list vit aussi sans le calendrier | deux modules à construire ; une tâche **posée sur un créneau** (time-blocking) demande un geste entre les deux |
| **c. Les deux réunis** | un seul module « agenda et tâches » (façon TickTick, Morgen) | tout au même endroit | le plus gros module d'Atlas, contraire au découpage par domaine du hub |

**Recommandation : b.** Un calendrier et une to-do list répondent à deux questions différentes
(« quand ? » et « quoi faire ? »), et le marché les garde séparés. Le lien se fait par un service :
le calendrier affiche les tâches datées **en calque**, et pourra plus tard proposer de **poser une
tâche sur un créneau** (le time-blocking de Morgen, sans IA). Ordre possible : le calendrier
d'abord, la to-do list ensuite, ou l'inverse si c'est la liste qui manque le plus.

---

## 6. Les liens avec les modules d'Atlas

**Le mécanisme.** Un service `calendar`, sur le modèle de celui que rend Astra à Comète : chaque
module qui le souhaite **déclare une source** (`provides.calendarSources`) avec un nom, une couleur
et une fonction « ce que je sais entre tel jour et tel jour ». Le calendrier les affiche en
**calques activables** (« Afficher : ✓ Zénith ✓ Orbite ☐ Astra »), en lecture seule, sans rien
copier. Petit ajout au socle : `collectServices` garde aujourd'hui un seul fournisseur par service,
il faudra qu'il **additionne** les sources de plusieurs modules.

| Module | Ce qu'il peut montrer | Sens | Valeur | Priorité |
|---|---|---|---|---|
| **Tâches** (option b) | les tâches datées, cochables depuis le calendrier | lecture, puis écriture (cocher) | **forte** : c'est la moitié de la demande | 1 |
| **Zénith** | les check-ins de chaque jour (✓ « Course 8 km ») ; les jours de série | lecture | moyenne : l'historique vu dans le temps | 2 |
| **Zénith** (plus loin) | poser une « séance de course » dans le calendrier, qui devient un check-in une fois faite | écriture, via un service de Zénith | forte, mais c'est un vrai chantier | plus tard |
| **Orbite** | le nombre de cartes à réviser chaque jour (« 12 cartes ») | lecture | petite mais utile : voir les jours chargés | 3 |
| **Comète** | les courses faites (magasin, total) ; un « jour de courses » récurrent peut simplement être un événement | lecture | petite | 4 |
| **Astra** | les dépenses par jour | lecture | faible : un calendrier n'est pas le bon endroit pour lire un budget | 5 |
| **Astra** (plus loin) | les **échéances** à venir (loyer, abonnements) | lecture | forte, mais Astra ne connaît pas encore les échéances — la détection des abonnements a été mise de côté par Jules | plus tard |
| **Cérès** | les kcal du jour, ou un planning de repas | lecture | faible aujourd'hui | plus tard |

**L'autre sens, aussi :** le calendrier peut rendre un service aux autres modules — par exemple à
la to-do list, pour **poser une tâche sur un créneau**.

---

## 7. Le modèle de données

Tables préfixées `calendar_`, toutes avec `user_id` et leurs quatre politiques RLS.

| Table | Rôle | Colonnes principales |
|---|---|---|
| `calendar_events` | un événement, ou une série | titre, `all_day`, jour de début et de fin, heure de début et de fin (nulles en journée entière), **fuseau** (`Europe/Paris`), règle de récurrence (nulle si ponctuel), couleur ou catégorie, lieu, note, rappel en minutes |
| `calendar_exceptions` | une occurrence supprimée ou modifiée | événement, **jour de l'occurrence**, nature (`skip` / `override`), champs remplacés |

**Stocké : la règle. Calculé : les occurrences, jamais stockées** — même principe que le solde
d'une enveloppe d'Astra. Une bibliothèque pure, testée avant tout écran (`lib/recurrence.ts`),
déplie une série sur une période en appliquant les exceptions ; une autre dispose les événements
qui se chevauchent dans une journée.

**Les heures sont des heures locales**, avec le fuseau à côté — jamais converties en UTC pour
calculer une récurrence : « tous les mardis à 9 h » doit rester 9 h après le passage à l'heure
d'hiver. C'est le même esprit que le « jour local » partout dans Atlas.

**Bibliothèque de récurrence :** `rrule` (licence BSD-3) couvre toute la norme, mais raisonne en
UTC « flottant » et demande de la prudence avec les changements d'heure. Le sous-ensemble utile
(§3) s'écrit et se teste à la main en quelques centaines de lignes, dans le style d'Atlas. Choix à
confirmer à l'étape 2.

---

## 8. Ce qui va bloquer, ou coûter

| Obstacle | Gravité | Réponse |
|---|---|---|
| **Les exceptions de récurrence** (« celui-ci seulement / tous les suivants ») | la vraie difficulté | règle + exceptions, jamais d'occurrences stockées ; tests d'abord |
| **Les changements d'heure** | piège classique | heures locales et fuseau, jamais d'UTC pour la récurrence ; tests aux dates de bascule |
| **La grille horaire et le glisser-déposer au doigt** | beaucoup de travail | FullCalendar (MIT) pour semaine et jour (§4) |
| **Les rappels à l'heure près** | faisable | une nouvelle fonction planifiée par pg_cron toutes les 5 minutes : environ 9 000 appels par mois, loin de la limite gratuite ; précision de ± 5 minutes |
| **Voir Atlas dans le Calendrier de l'iPhone** | faisable, gratuit | un **flux ICS** en lecture seule servi par une Edge Function ; l'iPhone s'y abonne et le rafraîchit selon le réglage choisi (de 5 minutes à une semaine) — Google, lui, toutes les 8 à 24 h. L'adresse du flux contient un **jeton secret** révocable, puisque l'app Calendrier ne peut pas se connecter à un compte |
| **Écrire dans iCloud ou Google** (synchro dans les deux sens) | lourd | CalDAV (mots de passe d'application Apple) ou OAuth Google : **écarté**, au moins en V1 |
| **Saisie rapide en langage naturel** (« dentiste mardi 14h ») | confort | possible plus tard, en français seulement, par une bibliothèque pure maison |
| **Partage de calendrier** | social | écarté (règle n°2 de `CLAUDE.md`) |

Aucun service payant n'est nécessaire.

---

## 9. Nommer le module — à trancher ensemble

Nom technique proposé : **`calendrier`** (tables `calendar_*`, classes `.calendrier-*`).

Pour le nom affiché, dans la famille céleste (Atlas, Zénith, Astra, Orbite, Cérès, Comète) :

- **Éclipse** *(proposition)* — l'événement astronomique daté par excellence, prévu des siècles
  à l'avance.
- **Saros** — le cycle de 18 ans qui fait revenir les éclipses : la récurrence.
- **Solstice** — les jours qui rythment l'année.

Et si la to-do list devient un module (option b), il faudra lui trouver un nom dans la même veine
(par exemple **Polaris**, l'étoile qu'on suit pour savoir quoi faire ensuite).

---

## 10. Découpage proposé

| Étape | Contenu | Résultat |
|---|---|---|
| 1 | Migration, contrat et ses deux implémentations, module signet | le module existe |
| 2 | Bibliothèques pures : récurrence et exceptions, disposition des chevauchements, grille du mois — tests aux dates piégeuses | la règle est juste |
| 3 | Vue **mois** et vue **agenda**, créer et modifier un événement (journée, horaire, plusieurs jours) | **la V1** |
| 4 | Vues **semaine** et **jour** (grille horaire, glisser-déposer) | on voit ses heures |
| 5 | Récurrence complète à l'écran : « cet événement / tous les suivants / tous » | les séries se gèrent |
| 6 | **Calques** des autres modules (service `calendarSources`), en commençant par la to-do list si elle existe, puis Zénith, Orbite, Comète | le calendrier d'Atlas |
| 7 | **Rappels** push avant un événement | on n'oublie plus |
| 8 | **Flux ICS** pour le Calendrier de l'iPhone | Atlas dans l'iPhone |

Et, si l'option b est retenue, **un module de tâches** avec sa propre étude, avant ou après.

---

## 11. Questions à trancher ensemble

*Tranchées depuis : voir §12.*

1. **Le nom** : Éclipse, Saros, Solstice, ou autre ?
2. **Les tâches** : option **a** (événement cochable), **b** (un module de to-do list à part,
   recommandé) ou **c** (tout dans un seul module) ? Et si b, lequel d'abord : le calendrier ou la
   liste de tâches ?
3. **Les vues de la V1** : mois et agenda d'abord, semaine et jour ensuite, ou les quatre dès la V1 ?
4. **FullCalendar** (MIT, lourd) pour la grille horaire, ou tout écrit à la main ?
5. **Les rappels** avant un événement : dans la V1, ou plus tard ?
6. **Le flux ICS** vers le Calendrier de l'iPhone : utile pour toi ?
7. **Les calques** : lesquels t'intéressent vraiment parmi Zénith, Orbite, Comète, Astra, Cérès ?

---

## 12. Décisions prises avec Jules (27/09/2026)

| Question (§11) | Décision | Conséquence |
|---|---|---|
| 1. Nom | **Éclipse** | `label: 'Éclipse'` ; nom technique `calendrier` |
| 2. Tâches | **Option b : un module de to-do list à part**, pour plus tard | le calendrier se construit d'abord seul ; la to-do list aura sa propre étude, et s'affichera ensuite dans le calendrier en calque |
| 3. Vues de la V1 | **Semaine et jour dès le début**, avec mois et agenda | la grille horaire fait partie de la V1 : le découpage §10 fusionne les étapes 3 et 4 |
| 4. FullCalendar | **Oui, pour les quatre vues** (confirmé le 27/09/2026, voir ci-dessous) | dépendance MIT, chargée à la demande ; récurrence et exceptions restent à nous |
| 5. Rappels | **Plus tard** | étape 7 inchangée, hors V1 |
| 6. Flux ICS vers l'iPhone | **Pas pour l'instant** | étape 8 mise de côté |
| 7. Calques | **Oui**, après la V1 : Zénith, Orbite, Comète, Astra, puis la to-do list quand elle existera | un service `calendarSources` au socle ; `collectServices` apprend à additionner plusieurs fournisseurs |

**La recommandation sur FullCalendar, revue avec cette décision.** Avec la semaine et le jour dès
la V1, la grille horaire n'est plus un « plus tard » : c'est le cœur de l'écran. Or c'est
précisément la partie la plus coûteuse à écrire à la main — disposer côte à côte des événements
qui se chevauchent, glisser pour créer un créneau, déplacer ou étirer un événement au doigt, la
ligne de l'heure qu'il est, faire défiler jusqu'à l'heure courante. FullCalendar fait tout cela,
sous licence MIT pour ces vues, et **ses vues mois et liste viennent avec** : autant l'utiliser pour
les quatre, avec un seul langage de gestes et un seul style à accorder au thème d'Atlas, plutôt
que de mélanger des vues maison et des vues de bibliothèque. La récurrence et les exceptions
restent à nous (§7) : le calendrier lui donne seulement des occurrences déjà dépliées. Il est
chargé à la demande, dans le seul module : le reste d'Atlas n'en porte pas le poids, mesuré au
build dès l'étape 1.

### Découpage révisé (remplace §10)

| Étape | Contenu | Résultat |
|---|---|---|
| 1 ✅ | Migration, contrat et ses deux implémentations, module signet ; FullCalendar installé et son poids mesuré au build | le module existe — livré le 27/09/2026, voir §13 |
| 2 ✅ | Bibliothèques pures : récurrence et exceptions, heures locales et changements d'heure — tests aux dates piégeuses | la règle est juste — livré le 27/09/2026, voir §14 |
| 3 ✅ | Les quatre vues (mois, semaine, jour, agenda) avec FullCalendar, accordées au thème d'Atlas ; créer, déplacer, étirer, modifier un événement (journée, horaire, plusieurs jours) | **la V1** — livré le 27/09/2026, voir §15 |
| 4 ✅ | La récurrence à l'écran : créer une série, « cet événement / tous les suivants / tous » | les séries se gèrent — livré le 27/09/2026, voir §16 |
| 5 ✅ | Les calques : service `calendarSources`, puis Zénith, Orbite, Comète, Astra | le calendrier d'Atlas — livré le 27/09/2026, voir §17 |
| plus tard | rappels push ; la to-do list (module à part, sa propre étude) et son calque ; flux ICS | — |

---

## 13. Étape 1 : le module existe (27/09/2026)

- **Migration** `supabase/2026-09-27-calendar-tables.sql` : `calendar_events` (un événement ou une
  série) et `calendar_exceptions` (une occurrence supprimée ou modifiée), RLS complet. La base
  refuse d'elle-même ce qui n'a pas de sens : une fin avant le début ; une journée entière avec
  des heures ; un horaire sans heures ; une fin avant le début le même jour (mais « 21 h – 2 h »
  le lendemain passe) ; une fréquence inconnue ; une exception « modifiée » sans champs remplacés,
  ou une « supprimée » qui en aurait. **Une seule exception par occurrence** (contrainte unique) :
  la reposer la remplace.
- **Contrat** `CalendarStore` et ses deux implémentations (`LocalCalendar`, `SupabaseCalendar`).
  Il stocke des événements et des séries, **jamais des occurrences**. Il charge tous les
  événements plutôt qu'une période : une série commencée il y a un an compte encore aujourd'hui,
  et le volume reste petit. Postgres rend une heure « 14:00:00 », l'application parle en
  « 14:00 » : la conversion est faite à la lecture.
- **Le fuseau** de chaque événement est celui de l'appareil à la création (`Europe/Paris` à
  défaut).
- **Couleurs par nom** (bleu, vert, orange, rose, violet, gris), pas par code : c'est le thème
  d'Atlas qui choisira la teinte exacte. Couleurs, fréquences et natures d'exception sont des
  tableaux `as const` comparés par un test aux contraintes de la migration.

**FullCalendar : la version 6, pas la 7.** La v7, sortie en juin 2026, a réorganisé ses paquets
(`@full-ui/headless-calendar`), et ses vues n'existent qu'en version candidate. La **v6.1.21**
(juin 2026 aussi) accepte React 19, ses six paquets sont stables et cohérents entre eux : elle est
**épinglée à la version exacte**, comme `zxing-wasm` pour Cérès. **Poids mesuré : 76 Ko compressés**
(263 Ko bruts) pour les vues mois, semaine, jour et liste, le glisser-déposer et le français —
autant que la table CIQUAL de Cérès. Il ne sera chargé qu'à l'ouverture d'Éclipse (étape 3).

**Migration à appliquer** dans Supabase Studio avant d'utiliser Éclipse en mode comptes.

---

## 14. Étape 2 : la récurrence, testée avant tout écran (27/09/2026)

Quatre bibliothèques pures, 47 tests pour le module, aucun écran.

**`lib/recurrence.ts` — le cœur.** Le moteur parcourt les jours un à un et demande à chacun
« es-tu dans la série ? », plutôt que de sauter d'occurrence en occurrence : plus lent en théorie,
négligeable pour un calendrier personnel, et bien plus facile à rendre juste. Les choix, tous
testés :

- **« le 31 de chaque mois » saute les mois sans 31**, comme la norme (RFC 5545) et Google
  Agenda — il ne glisse pas au 30 ;
- **« le 29 février chaque année » n'a lieu que les années bissextiles** ;
- **`count` compte depuis le début de la série**, exceptions comprises : supprimer une occurrence
  n'en ajoute pas une à la fin ;
- **les semaines commencent le lundi** (la norme, par défaut) : « un mardi et jeudi sur deux »
  suit la semaine de départ, sans rien avant le premier jour ;
- **une série à 9 h reste à 9 h après le passage à l'heure d'hiver** : aucune heure n'est jamais
  convertie, et les écarts entre jours se comptent en UTC pur, jamais avec des dates locales qui
  dureraient 23 ou 25 heures.

`expandEvents` rend les occurrences d'une période, exceptions appliquées : une occurrence
supprimée disparaît ; une occurrence modifiée prend ses nouveaux champs, **y compris déplacée
d'un jour hors de la période vers un jour dedans** (et quitte alors son ancien jour) ; une
exception posée sur un jour qui n'appartient pas à la série est ignorée ; un événement de
plusieurs jours touche une période qui commence après son début, et une série de plusieurs jours
garde sa durée à chaque occurrence. `occurrenceRange` traduit une occurrence pour FullCalendar
(heures locales « flottantes », et fin **exclusive** pour une journée entière). `splitSeries`
prépare « tous les suivants » : la série s'arrête la veille, la suite repart avec la même règle —
et, pour une série comptée, avec le bon nombre d'occurrences restantes.

**`lib/validation.ts`** reprend les contraintes de la base en français (« La fin doit être après le
début, ou le lendemain pour une soirée qui passe minuit ») ; **`lib/describe.ts`** dit une série en
toutes lettres (« Toutes les 2 semaines le mardi et le jeudi, jusqu'au 31 décembre 2026 ») ;
**`lib/day.ts`** porte les outils de dates.

---

## 15. Étape 3 : les quatre vues, la V1 (27/09/2026)

**L'écran.** Quatre vues dessinées par FullCalendar : **Mois**, **Semaine**, **Jour** et
**Agenda** (la liste de la semaine). Sur ordinateur, la semaine s'ouvre par défaut ; sur
téléphone (moins de 700 px), c'est le jour, et les boutons des vues passent en bas de l'écran
pour laisser le titre respirer en haut. La dernière vue choisie est retenue sur l'appareil
(`calendrier.view.v1`, un confort, pas une donnée). La grille s'ouvre sur l'heure courante moins
une, avec la ligne rouge de « maintenant ». Tout est en français, les semaines commencent le
lundi, la bande des journées entières s'appelle « Journée ».

**Créer.** Trois façons : le bouton « Nouvel événement » (l'heure pleine suivante, pour une
heure) ; **toucher ou glisser sur un créneau** de la grille (un simple toucher d'une demi-heure
devient une heure, plus utile) ; ou une case de la vue Mois (journée entière). Au doigt, un appui
de 350 ms sépare la sélection du simple défilement. La fenêtre porte le titre, « Toute la
journée », les jours et heures de début et de fin, six pastilles de couleur, le lieu et une note.
Déplacer le jour de début garde la durée : un séjour de trois jours le reste. Les règles de la
base y sont dites en français (`lib/validation.ts`), avant tout envoi ; en cas d'échec, la
fenêtre reste remplie.

**Déplacer, étirer, modifier, supprimer.** Un événement ponctuel se glisse ailleurs ou
s'étire ; si l'enregistrement échoue, il revient à sa place et l'erreur s'affiche. Le toucher
l'ouvre pour le modifier ou le supprimer (après confirmation). **Une série ne se déplace pas
encore au doigt** (`editable: false` sur ses occurrences) : déplacer « cette occurrence » ou
« toute la série » est justement la question de l'étape 4. D'ici là, la toucher modifie toute la
série, et la fenêtre le dit.

**Le pont avec FullCalendar** (`lib/calendarBridge.ts`, pur et testé) : FullCalendar ne reçoit que
des occurrences déjà dépliées pour la période affichée (`expandEvents`), la récurrence reste à
nous ; les dates sont locales, sans fuseau (`timeZone: 'local'`), et une journée entière finit la
veille de la fin exclusive que FullCalendar rend.

**Le poids.** `CalendarView.tsx` est le seul fichier qui importe FullCalendar, et il est chargé à
la demande (`React.lazy`) : un fichier à part au build (**79 Ko compressés**, 269 Ko bruts), que
ni le hub ni les autres modules ne téléchargent. Une vérification e2e le contrôle sur les
requêtes réseau.

**Le thème.** Les variables de FullCalendar (`--fc-*`) sont redéfinies sur celles d'Atlas (fond
sombre, bordures, violet d'accent pour aujourd'hui et le bouton actif) ; les six couleurs
d'événement sont des classes (`calendrier-event-<couleur>`) qui colorent la grille, les points du
mois et les pastilles de l'agenda.

**Vérifié** à l'œil sur ordinateur (semaine, mois, agenda) et sur téléphone, sans débordement ni
erreur JavaScript ; 33 vérifications de bout en bout, dont un vrai glisser sur la grille.

---

## 16. Étape 4 : les séries à l'écran (27/09/2026)

**Créer une série.** La fenêtre d'un événement gagne « Répéter », juste sous les dates : ne se
répète pas, tous les jours, toutes les semaines, tous les mois, tous les ans ; « tous les N » ; pour
les semaines, sept pastilles L M M J V S D (le jour du début est choisi d'office, et le suit si on
change ce jour) ; la fin : jamais, à une date, ou après N fois. La règle se relit en toutes lettres
sous les champs (« Toutes les semaines le jeudi et le dimanche, 10 fois. »), pour qu'une erreur se
voie avant d'enregistrer.

**Modifier, déplacer, supprimer une occurrence.** Toucher une occurrence ouvre ses valeurs à elle
(exception comprise), avec la règle de sa série. Enregistrer, supprimer ou la **glisser** dans la
grille pose la question de tout agenda : **cet événement**, **cet événement et les suivants**, ou
**tous les événements**. Quand c'est la répétition elle-même qui change, « cet événement » n'est
pas proposé : une règle vaut pour une suite, pas pour un jour. Annuler (ou Échap) ferme la
question sans fermer la fenêtre ; après un glisser, l'occurrence revient à sa place.

**La règle, pure et testée** (`lib/seriesEdit.ts`, 17 tests) traduit chaque choix en écritures
(`SeriesPlan`) :

- **cet événement** : une exception qui ne garde que ce qui diffère de la règle, et qui
  **remplace** la précédente plutôt que de s'y ajouter ; revenir exactement à la règle retire
  l'exception ; supprimer pose une exception « supprimée » ;
- **tous** : on n'applique à la série que **ce qui a changé dans la fenêtre**. Renommer une
  occurrence déplacée à 19 h ne ramène pas toute la série à 19 h ; la décaler d'un jour décale la
  série d'un jour. Décaler la série ou changer sa règle efface ses exceptions, qui désignent des
  jours qui n'en font plus partie ;
- **les suivants** : la série s'arrête la veille (`splitSeries`, étape 2) et une nouvelle repart
  de cette occurrence avec les changements, et, pour une série comptée, avec le bon nombre
  d'occurrences restantes. Les exceptions d'avant la coupure restent, celles d'après partent avec
  l'ancienne série. Depuis la toute première occurrence, c'est la série entière.

**L'ordre des écritures** (`data/applyPlan.ts`) : elles ne forment pas une transaction, alors
pour « les suivants » la nouvelle série est **créée avant** que l'ancienne soit raccourcie. Une
coupure entre les deux laisse au pire des occurrences en double, visibles et faciles à retirer,
jamais des occurrences disparues. Aucune migration : les tables de l'étape 1 portaient déjà règles
et exceptions.

**Vérifié** de bout en bout sur une série de sept jours, du lundi au dimanche de la semaine en
cours : renommer mercredi seul, avancer vendredi et la suite à 6 h, supprimer mardi seul, refuser
« cet événement » quand la règle change, glisser lundi à 8 h « cet événement », puis supprimer
« tous » depuis samedi — qui retire la série détachée au vendredi, pas celle d'origine.

---

## 17. Étape 5 : les calques des autres modules (27/09/2026)

**Le mécanisme, dans le socle** (`core/lib/services.ts`). Un nouveau service, `calendarSources` :
un module qui a quelque chose à montrer dans le calendrier déclare une **source** — son nom, sa
couleur, s'il s'affiche d'office, et `marksBetween(from, to)`, qui rend des **marques** : un jour,
un titre, un détail. Toujours sur la journée entière, en lecture seule : Éclipse les affiche, il ne
les possède pas, et rien n'est copié. `collectServices` distingue désormais deux sortes de
services : ceux qu'un seul module rend (`expenses`, le premier déclaré l'emporte) et ceux que
plusieurs modules **additionnent**, déclarés en tableau (`calendarSources`), dans l'ordre du
registre. Éclipse ne connaît aucun des modules qu'il affiche ; un module retiré du registre fait
simplement disparaître son calque.

**Les quatre calques**, chacun calculé par son module dans une bibliothèque pure et testée
(`lib/calendarMarks.ts`), branchée sur son contrat de stockage (`data/calendarSource.ts`) :

| Calque | Ce qu'il montre | D'office |
|---|---|---|
| **Zénith** | une marque par objectif et par jour fait : « ✓ 🏃 Course 10,5 km, Étirements », l'objectif au survol | affiché |
| **Orbite** | les jours passés, les cartes révisées (« ✓ 12 cartes révisées ») ; aujourd'hui et après, celles à réviser, les cartes en retard comptant aujourd'hui, le détail par paquet au survol ; les paquets archivés ne comptent pas | affiché |
| **Comète** | les courses faites : « 🛒 Lidl · 54,20 € », le numéro de course et la note au survol | affiché |
| **Astra** | ce qui a été dépensé chaque jour, avec les mêmes exclusions que le camembert (virements internes, épargne, entrées) : « 42,50 € dépensés », les lignes au survol | **masqué** — un calendrier n'est pas le bon endroit pour lire un budget (§6), on l'allume au besoin |

**À l'écran.** Une rangée de pastilles « Calques » au-dessus du calendrier, une par source, à la
couleur de son module ; l'allumer ou l'éteindre est retenu sur l'appareil (`calendrier.layers.v1`,
un confort, pas une donnée). Sur téléphone, la rangée tient sur une ligne qui défile. Les marques
passent après les événements d'Éclipse dans chaque jour ; les toucher n'ouvre rien, leur origine
et leur détail sont au survol. Chaque calque se charge seul : un module en panne n'empêche pas
les autres, sa pastille porte un ⚠.

**Pas encore** : les calques de Cérès (kcal du jour) et de la future to-do list, poser une séance
de Zénith dans le calendrier, les échéances d'Astra — tous notés au §6 pour plus tard.

**Vérifié** à l'œil sur ordinateur (semaine et mois) et sur téléphone, avec des données des
quatre modules ; 12 vérifications de bout en bout, dont le choix des calques retenu après un
rechargement.

---

## 18. Répéter avec plus de finesse (28/09/2026)

Demande de Jules : « je veux pouvoir mettre un événement répété tous les jours **sauf** le samedi et
le dimanche ». Le moteur commun (`core/lib/recurrence.ts`, partagé avec Polaris) gagne deux choses :

- **« Tous les jours » avec des jours retenus** (`byWeekday` vaut aussi pour `daily`) : sous « Tous
  les jours », les sept pastilles L M M J V S D, toutes allumées ; en éteindre se relit « Tous les
  jours sauf le samedi et le dimanche » (au moins quatre jours gardés : on dit ceux qu'on saute ;
  sinon « seulement le samedi et le dimanche »). Un raccourci **« Tous les jours ouvrés (lundi –
  vendredi) »** dans le menu, que le menu reconnaît aussi quand on y arrive par les pastilles.
- **« Tous les mois » par rang** (`byNthWeekday`), comme Google Agenda : « le 28 de chaque mois »,
  « le 4e lundi de chaque mois » ou « le dernier lundi de chaque mois », proposés d'après le jour de
  début (`monthlyChoices`) — un 5e mardi n'est offert que comme « le dernier », il n'existe pas tous
  les mois.

Aucune migration : la règle vit en JSON, seule sa fréquence est contrôlée par la base. Les
exceptions d'une occurrence (« sauf le 14 ») existaient déjà (étape 4).

---

## Sources

- Comparatifs 2026 : [Zapier, meilleures applis de calendrier](https://zapier.com/blog/best-calendar-apps/),
  [2sync, 10 applis de calendrier](https://2sync.com/blog/best-calendar-apps),
  [Fantastical, Google, Apple, Outlook, Notion Calendar comparés](https://unstar.app/blog/fantastical-google-apple-outlook-notion-calendar-apps-ranked-2026)
- Licences : [FullCalendar](https://fullcalendar.io/license) (MIT hors extensions premium),
  [plugin RRule de FullCalendar](https://fullcalendar.io/docs/rrule-plugin),
  [rrule.js, licence BSD-3](https://github.com/jkbrzt/rrule/blob/master/LICENCE)
- Abonnement ICS : [webcal et abonnements](https://addcal.co/blog/what-is-webcal-subscription-calendar-urls),
  [fréquence de rafraîchissement de Google Calendar](https://usemooncal.com/en/guides/google-calendar-ics-refresh)
- Rappels existants : `docs/rappels-mise-en-place.md` (pg_cron et Edge Functions dans l'offre gratuite)
