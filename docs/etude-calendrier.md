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
| 1 | Migration, contrat et ses deux implémentations, module signet ; FullCalendar installé et son poids mesuré au build | le module existe |
| 2 | Bibliothèques pures : récurrence et exceptions, heures locales et changements d'heure — tests aux dates piégeuses | la règle est juste |
| 3 | Les quatre vues (mois, semaine, jour, agenda) avec FullCalendar, accordées au thème d'Atlas ; créer, déplacer, étirer, modifier un événement (journée, horaire, plusieurs jours) | **la V1** |
| 4 | La récurrence à l'écran : créer une série, « cet événement / tous les suivants / tous » | les séries se gèrent |
| 5 | Les calques : service `calendarSources`, puis Zénith, Orbite, Comète, Astra | le calendrier d'Atlas |
| plus tard | rappels push ; la to-do list (module à part, sa propre étude) et son calque ; flux ICS | — |

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
