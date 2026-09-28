# Tâches — étude du septième module (la to-do list)

*Étude de conception, écrite avant le code — même exercice que `docs/etude-nutrition.md`,
`docs/etude-courses.md` et `docs/etude-calendrier.md`. Objectif : voir ce que fait le marché, ce
qu'une liste de tâches demande vraiment, où passe la frontière avec Zénith, et **ce que le module
peut échanger avec les autres**. Les décisions qui reviennent à Jules sont regroupées en fin de
document (§11).*

Demande de Jules (27/09/2026) : « prochain module, la todo list, fais une analyse ». Le principe
était déjà posé par l'étude du calendrier (§5, option b, confirmée le 27/09/2026) : **un module de
tâches à part**, dont les tâches datées s'affichent dans Éclipse.

---

## 1. Ce qui existe déjà, et sur quoi ce module s'appuie

Comme les six modules précédents, celui-ci hérite du socle : comptes, Row Level Security,
synchronisation entre appareils, sauvegarde par module, hébergement. Cinq pièces comptent
particulièrement ici :

- **Les calques d'Éclipse** (`core/lib/services.ts`, `calendarSources`, livrés à l'étape 5 du
  calendrier) : un module déclare une source, Éclipse l'affiche. Les tâches datées y entrent
  **sans rien ajouter au socle** — c'est exactement ce pour quoi le mécanisme a été construit.
- **La file hors ligne commune** (`core/data/outbox.ts`) : une tâche se note souvent dans la rue,
  entre deux choses. Cérès a montré comment s'y brancher (id choisi par l'application avant le
  premier envoi, écriture idempotente, réapplication à l'écran).
- **Les rappels push** : Web Push, clés VAPID, Edge Function `send-reminders`, et **pg_cron**,
  compris dans l'offre gratuite de Supabase, les déclenchent déjà pour Zénith
  (`docs/rappels-mise-en-place.md`). Aucune infrastructure à créer, seulement une nouvelle
  requête planifiée (§8).
- **Le moteur de récurrence d'Éclipse** (`calendrier/lib/recurrence.ts`) : pur, testé aux dates
  piégeuses (31 du mois, 29 février, changement d'heure). Une tâche répétée « tous les lundis »
  en a besoin tel quel — mais un module n'importe jamais un autre (§7).
- **Zénith**, qui gère déjà des « actions » répétées : la frontière entre une habitude et une
  tâche doit être tracée avant tout code, sinon les deux modules se marcheront dessus (§5).

---

## 2. Le marché

| Application | Ce qui la distingue | Prix (2026) | À reprendre ? |
|---|---|---|---|
| **Todoist** | ajout rapide en langage naturel (« demain 18h #courses p1 »), projets, priorités 1 à 4, récurrence « every » (date fixe) et « every! » (après l'avoir faite) | gratuit limité à 5 projets et rappels de base ; Pro 5 $/mois | **oui** : le langage naturel, les deux récurrences |
| **Things 3** | vues Aujourd'hui / À venir / N'importe quand / Un jour ; distingue **« quand »** (le jour où je compte la faire) de **l'échéance** (le jour où elle doit être faite) ; une section « Ce soir » | achat unique, par appareil | **oui** : les vues, et la distinction date prévue / échéance |
| **Rappels d'Apple** | listes, listes intelligentes, sous-tâches ; les rappels datés apparaissent dans Calendrier | gratuit, Apple seulement | **oui** : les tâches datées dans le calendrier |
| **Microsoft To Do** | « Ma journée » : chaque matin, on choisit ce qu'on fera aujourd'hui, la liste se vide la nuit | gratuit | à discuter : le rituel du jour |
| **TickTick** | tâches, calendrier, habitudes et Pomodoro dans une seule app | gratuit limité ; Premium ~36 $/an | non : Atlas sépare déjà ces rôles en modules |
| **Google Tasks** | minimaliste, visible dans Google Agenda | gratuit | l'esprit : peu de champs |
| **Sunsama**, **Structured** | planification du jour : on pose ses tâches sur des créneaux (*time-blocking*) | Sunsama ~20 $/mois | plus tard : poser une tâche sur un créneau d'Éclipse |
| **Motion**, **Reclaim** | l'IA place les tâches dans l'agenda toute seule | payants | **non** (règle n°1) |

**Ce qui revient partout :**

1. **La saisie éclair.** Noter une tâche doit prendre deux secondes, sans formulaire : une barre
   d'ajout toujours visible, et une **boîte de réception** pour ce qui n'est pas encore rangé.
2. **La vue « Aujourd'hui »**, qui rassemble ce qui est prévu aujourd'hui **et ce qui est en
   retard** — c'est l'écran qu'on ouvre, tous les autres servent à ranger.
3. **Deux dates distinctes chez les meilleurs** (Things) : *quand je compte la faire* et *quand elle
   doit être faite*. Beaucoup d'applications n'en ont qu'une, et l'utilisateur détourne l'échéance
   pour dire « je la ferai lundi ».
4. **Deux sortes de répétition** (Todoist) : « tous les lundis » (date fixe, qu'on l'ait faite ou
   non) et « 10 jours après l'avoir faite » (changer les draps, arroser les plantes).
5. **Les tâches datées se voient dans le calendrier**, et les meilleurs outils permettent de les
   **poser sur un créneau**.

---

## 3. Les briques d'une tâche

| Brique | Proposition | Remarque |
|---|---|---|
| Titre, note | oui | la note, libre, en texte simple |
| Liste | facultative ; sans liste = **boîte de réception** | des listes simples (Maison, Travail, Papiers…), une couleur chacune, **un seul niveau** : pas de dossiers de listes |
| Jour prévu | facultatif | « quand je compte la faire » ; c'est lui qui la fait entrer dans Aujourd'hui |
| Heure | facultative, seulement avec un jour | pour « appeler le garage à 9 h » ; c'est aussi ce qui permettra un rappel |
| Échéance | facultative | « avant le 15 » ; affichée en rouge si dépassée, entre dans Aujourd'hui les derniers jours |
| Priorité | à décider (§11) | trois niveaux suffisent (normale, importante, urgente) ; Todoist en a quatre, beaucoup de gens n'en utilisent aucun |
| Sous-tâches | **un seul niveau** | « Déménagement » → « résilier la box », « cartons »… ; comme les sous-catégories d'Astra, jamais plus profond |
| Répétition | date fixe **ou** après l'avoir faite | voir ci-dessous |
| Faite | date de complétion | une tâche faite reste consultable (vue Terminées), jamais effacée d'office |
| Ordre | manuel dans une liste | un glisser-déposer, au doigt aussi |

**La répétition d'une tâche n'est pas celle d'un événement.** Un événement répété a toutes ses
occurrences en même temps (on voit les dix mardis à venir). Une tâche répétée n'en a **qu'une à
la fois** : la prochaine. Quand on la coche, elle est notée comme faite et **réapparaît à sa date
suivante** — soit la suivante de la règle (date fixe), soit aujourd'hui + N jours (après l'avoir
faite). Une tâche « tous les lundis » oubliée trois semaines ne doit pas afficher trois retards,
mais une seule tâche en retard.

---

## 4. Les vues

| Vue | Contenu | Pour quoi |
|---|---|---|
| **Aujourd'hui** | prévu aujourd'hui + en retard + échéance proche | l'écran d'ouverture, sur téléphone surtout |
| **À venir** | les 14 prochains jours, jour par jour | voir la semaine chargée, décaler |
| **Boîte de réception** | les tâches sans liste | ranger ce qu'on a noté vite |
| **Listes** | une liste à la fois, sous-tâches dépliables | le travail de fond |
| **Terminées** | ce qui a été fait, par jour | la satisfaction, et retrouver une chose faite |

La barre d'ajout est présente sur toutes les vues, et ajoute là où l'on est (une tâche ajoutée dans
Aujourd'hui est prévue aujourd'hui, dans une liste elle y entre).

**La saisie en langage naturel, en français.** Taper « Appeler le garage demain 9h » et obtenir
une tâche prévue demain à 9 h, titre « Appeler le garage ». Deux voies, gratuites et sans IA :

- **`chrono-node`** (licence MIT) : le français y est annoncé comme pris en charge complètement,
  avec des analyseurs pour « aujourd'hui / demain », les jours de la semaine, les heures, « dans
  3 jours » et les dates en toutes lettres. Poids à mesurer, et à charger avec l'écran du module
  seulement, comme FullCalendar.
- **Un petit analyseur maison** : « aujourd'hui, demain, après-demain, lundi…dimanche, dans N
  jours/semaines, le 15, le 15 mars, 9h, 18h30 » couvre l'essentiel d'une liste de tâches. Pur et
  testé comme tout le reste.

Recommandation : essayer `chrono-node` sur une batterie de phrases françaises à l'étape 2 ; s'il
en rate de courantes ou pèse trop, l'analyseur maison. Dans les deux cas, **la date reconnue
s'affiche en pastille avant d'enregistrer**, et un clic l'annule : « Réunion de lundi » ne doit
pas devenir une tâche prévue lundi sans qu'on le voie.

---

## 5. Tâche ou habitude : la frontière avec Zénith

C'est la question qui compte le plus, parce qu'une tâche répétée et une action de Zénith se
ressemblent (« courir le mardi » pourrait être l'une ou l'autre).

| | **Zénith** — une habitude | **Tâches** — une chose à faire |
|---|---|---|
| Pourquoi | progresser vers un objectif | que ce soit fait |
| Répétition | c'est le principe | l'exception (changer les draps) |
| Si on ne la fait pas | la série s'arrête, rien ne s'accumule | elle reste là, en retard, jusqu'à ce qu'on la fasse ou la retire |
| Récompense | PP, rangs, série | la cocher |
| Exemples | courir, lire 20 min, Duolingo | renouveler le passeport, appeler le garage, déclarer ses impôts |

**Règle proposée :** ce qui se répète *pour progresser* va dans Zénith ; ce qui doit *être fait*
va dans les tâches. Pas de PP ni de série dans les tâches : ce serait refaire Zénith en moins bien,
et une tâche en retard n'est pas un échec de discipline.

**Le pont, plus tard :** une tâche rattachée à un objectif de Zénith (« s'inscrire au marathon »)
pourrait, une fois cochée, y devenir un **geste ponctuel** (un pas réel vers l'objectif, qui
existe déjà dans Zénith). Il faudrait que Zénith rende un service (« noter un geste ponctuel »),
sur le modèle d'`expenses` d'Astra. Utile, mais pas nécessaire pour commencer.

---

## 6. Les liens avec les modules d'Atlas

| Module | Lien | Sens | Valeur | Priorité |
|---|---|---|---|---|
| **Éclipse** | les tâches prévues ou à échéance, en **calque** (`calendarSources`) | lecture | **forte** : c'était la moitié de la demande du calendrier | 1 — sans toucher au socle |
| **Éclipse** | **cocher une tâche depuis le calendrier** | écriture | forte | 2 — le calque passe de la lecture à l'écriture : `CalendarMark` gagnerait une action facultative (« cocher »), donc un changement du socle |
| **Éclipse** | poser une tâche sur un **créneau** (*time-blocking*) | écriture | moyenne | plus tard — demande des marques horaires, pas seulement des journées |
| **Zénith** | une tâche cochée devient un geste ponctuel d'un objectif | écriture, via un service de Zénith | moyenne | plus tard (§5) |
| **Astra** | « payer la facture X » avant une échéance | aucun lien technique utile : c'est une tâche comme une autre | faible | — |
| **Comète** | « faire les courses » | la liste de courses est déjà le bon endroit | nulle | — |
| **Rappels** | « appeler le garage à 9 h » notifié à 9 h | — | forte, mais **commune avec Éclipse** | à décider (§8) |

**Les rappels méritent un mécanisme commun.** Éclipse a remis ses rappels à plus tard, les tâches
en voudront aussi : plutôt que deux fonctions planifiées qui lisent chacune leurs tables, un seul
mécanisme dans le socle — une table de rappels à venir (`user_id`, moment, titre, module), que
chaque module remplit quand on enregistre, et qu'une seule fonction planifiée par pg_cron envoie
toutes les 5 minutes (environ 9 000 appels par mois, largement dans l'offre gratuite). Chantier à
part, qui servirait aux deux modules.

---

## 7. Le modèle de données

Deux tables, préfixées par le nom technique proposé, `taches` :

**`taches_lists`** — `id`, `user_id`, `name`, `color` (par nom, comme Éclipse), `position`,
`archived`, `created_at`.

**`taches_tasks`** — `id` (**choisi par l'application**, pour la file hors ligne), `user_id`,
`list_id` (nullable = boîte de réception, `on delete set null` : supprimer une liste renvoie ses
tâches à la boîte de réception, jamais à la corbeille — même principe que « à classer » d'Astra),
`parent_id` (sous-tâche, un seul niveau, `on delete cascade`), `title`, `note`, `planned_day`,
`planned_time` (seulement avec un jour), `due_day`, `priority` (CHECK, pendant `as const`
testé), `recurrence jsonb` (la règle, plus son mode : date fixe ou après l'avoir faite),
`position`, `completed_at`, `created_at`.

**Cocher une tâche répétée** : la tâche elle-même avance à sa prochaine date, et une **trace**
de la complétion est gardée pour la vue Terminées. Deux façons de la garder — une ligne terminée
recopiée (simple, la vue Terminées lit une seule table) ou une petite table de complétions. La
première est recommandée : c'est ce que fait Todoist, et une tâche terminée n'a rien de plus
qu'une tâche.

**La récurrence : recopier ou partager ?** Le moteur d'Éclipse sait déjà dire « quel est le
prochain lundi », « le prochain 31 », sans erreur au changement d'heure. Deux voies :

- **le recopier** dans le module, comme `dayString` ou `money.ts` l'ont été — rapide, mais deux
  moteurs à maintenir, et un bug corrigé dans l'un reste dans l'autre ;
- **le remonter dans le socle** (`core/lib/recurrence.ts` : le type `Recurrence`, la règle,
  la validation, la description en toutes lettres), Éclipse et les tâches l'important tous deux.
  C'est exactement la règle de `CLAUDE.md` §3 : « si deux modules ont besoin de la même pièce,
  elle appartient au socle ». Coût : déplacer des fichiers d'Éclipse et leurs tests, sans changer
  de comportement.

Recommandation : **le remonter**, à l'étape 1 ou 2, avant d'écrire la récurrence des tâches.

---

## 8. Ce qui va bloquer, ou coûter

| Sujet | Difficulté | Réponse |
|---|---|---|
| Langage naturel en français | moyenne | `chrono-node` ou analyseur maison, testé sur une batterie de phrases ; toujours montrer ce qui a été compris (§4) |
| Deux sortes de répétition | moyenne | une seule tâche à la fois, jamais d'occurrences accumulées (§3) ; testé avant tout écran |
| Réordonner au doigt | moyenne | glisser-déposer dans une liste, sur téléphone ; une poignée plutôt que toute la ligne, pour ne pas gêner le défilement |
| Hors ligne | faible, déjà fait deux fois | la file commune, avec un id choisi par l'application |
| Rappels à l'heure | moyenne, mais **commune** | mécanisme du socle partagé avec Éclipse (§6) |
| Cocher depuis Éclipse | faible à moyenne | une action facultative sur `CalendarMark` ; première écriture à travers un calque |
| Glisser la limite avec Zénith | conceptuelle | la règle du §5, écrite dans l'écran vide du module |

Rien de payant, rien qui ne tienne dans l'offre gratuite.

---

## 9. Nommer le module

Nom technique proposé : **`taches`** (sans accent, comme le veut `CLAUDE.md` §4). Nom affiché, dans
la famille céleste :

- **Polaris** — l'étoile Polaire, celle qu'on suit pour savoir où aller : ce qu'une liste de
  tâches fait de sa journée. **Recommandé.**
- **Nova** — une étoile qui s'allume : chaque tâche nouvelle. Joli, mais moins parlant.
- **Vega** — une des étoiles les plus brillantes ; sonne bien, ne dit rien de la fonction.
- **Pulsar** — une étoile qui bat à intervalles réguliers : plutôt Zénith.

---

## 10. Découpage proposé

| Étape | Contenu | Résultat |
|---|---|---|
| 1 | Migration, contrat et ses deux implémentations, module signet ; si décidé, la récurrence remontée dans le socle | le module existe |
| 2 | Bibliothèques pures : prochaine date (les deux répétitions), ce qui entre dans Aujourd'hui et dans quel ordre, l'analyseur de dates en français | la règle est juste |
| 3 | Ajout rapide, vues Aujourd'hui, À venir, Boîte de réception et Listes ; cocher, modifier, supprimer | **la V1** |
| 4 | Répétition et sous-tâches à l'écran, vue Terminées, réordonner | les tâches de fond |
| 5 | Le calque dans Éclipse, puis cocher depuis le calendrier | le lien attendu |
| 6 | File hors ligne | noter sans réseau |
| plus tard | rappels communs (avec Éclipse) ; le pont avec Zénith ; poser une tâche sur un créneau | — |

---

## 11. Questions à trancher ensemble

1. **Le nom** : Polaris, Nova, Vega, autre ?
2. **La frontière avec Zénith** (§5) : d'accord avec « ce qui se répète pour progresser va dans
   Zénith, ce qui doit être fait va dans les tâches » ? Et donc pas de PP ni de série ici ?
3. **Une date ou deux** : seulement un jour prévu, ou jour prévu **et** échéance (§3) ?
4. **Les priorités** : oui (trois niveaux), ou pas du tout ?
5. **Les sous-tâches** dès la V1, ou plus tard ?
6. **Le langage naturel** (« demain 9h ») dès la V1, ou le formulaire d'abord ?
7. **Hors ligne** dans la V1, ou juste après comme pour Cérès ?
8. **Les rappels** : maintenant, via un mécanisme commun avec Éclipse (§6), ou plus tard ?
9. **Cocher depuis Éclipse** : le vouloir (petit changement du socle), ou se contenter de voir les
   tâches dans le calendrier ?
10. **La récurrence remontée dans le socle** (§7), partagée avec Éclipse — d'accord ?
11. **Le rituel du jour** façon « Ma journée » (Microsoft To Do) : choisir chaque matin ce qu'on
    fera aujourd'hui, ou la vue Aujourd'hui calculée suffit ?

---

## 12. Décisions prises avec Jules (27/09/2026)

| # | Question | Décision |
|---|---|---|
| 1 | Nom | **Polaris** (nom technique `taches`) |
| 4 | Priorités | **facultatives, trois niveaux** (normale, importante, urgente) ; une tâche sans priorité est normale |
| 5 | Sous-tâches | **dès la V1**, un seul niveau |
| 6 | Langage naturel | **dès la V1** : « Appeler le garage demain 9h » ; la date comprise s'affiche avant d'enregistrer |
| 7 | Hors ligne | **pas dans la V1** ; branché sur la file commune après, comme Cérès — les ids choisis par l'application dès l'étape 1 pour ne rien migrer alors |
| 8 | Rappels | **maintenant** : c'est le mécanisme commun du §6, construit une fois dans le socle, dont Polaris sera le premier utilisateur (Éclipse pourra s'y brancher ensuite à peu de frais) |
| 9 | Cocher depuis Éclipse | **oui** : `CalendarMark` gagne une action facultative, premier calque qui écrit |
| 2 | Frontière avec Zénith | **acceptée** : ce qui se répète pour progresser est une habitude (Zénith) ; ce qui doit être fait est une tâche — pas de PP, de série ni de rang dans Polaris. Le test : « si je rate un jour, est-ce que je recule (Zénith) ou est-ce juste en retard (Polaris) ? » |
| 3 | Une date ou deux | **deux** : le **jour prévu** (champ principal, rempli par le langage naturel) fait entrer la tâche dans Aujourd'hui ; l'**échéance**, facultative et discrète (« avant le 30 »), la fait passer en rouge quand c'est vraiment urgent |
| 10 | Récurrence partagée | **remontée dans le socle** (`core/lib/recurrence.ts`) à l'étape 1 : Éclipse et Polaris utilisent le même moteur testé, sans changement visible |
| 11 | Rituel du matin | **« Faire le point »** : n'apparaît qu'en cas de retards, chacun trié d'un geste (aujourd'hui, demain, un jour, sans date, supprimer) ; et un **rappel du matin** facultatif, « 4 tâches aujourd'hui, dont 1 urgente » |

Toutes les questions du §11 sont tranchées (la 2, la 3, la 10 et la 11 le même jour, après une
explication concrète).

### Découpage révisé (remplace §10)

| Étape | Contenu | Résultat |
|---|---|---|
| 1 ✅ | Migration, contrat et ses deux implémentations (ids choisis par l'application), module signet ; **la récurrence d'Éclipse remontée dans le socle** | le module existe — livré le 27/09/2026, voir §13 |
| 2 ✅ | Bibliothèques pures : prochaine date (les deux répétitions), contenu et ordre d'Aujourd'hui, **analyseur de dates en français** (`chrono-node` éprouvé sur une batterie de phrases, sinon fait maison) | la règle est juste — livré le 28/09/2026, voir §14 |
| 3 ✅ | Ajout rapide en langage naturel, vues Aujourd'hui, À venir, Boîte de réception, Listes ; cocher, modifier, supprimer ; **sous-tâches et priorités** | **la V1** — livré le 28/09/2026, voir §15 |
| 4 ✅ | Répétition à l'écran, vue Terminées, réordonner ; « Faire le point » | les tâches de fond — livré le 28/09/2026, voir §16 |
| 5 ✅ | **Rappels, mécanisme commun du socle** : table des rappels à venir, envoi par la fonction existante et pg_cron toutes les 5 minutes ; rappel à l'heure d'une tâche, et le rappel du matin | être prévenu — livré le 28/09/2026, voir §17 |
| 6 | Calque dans Éclipse, puis **cocher depuis le calendrier** | le lien attendu |
| 7 | File hors ligne | noter sans réseau |
| plus tard | rappels d'Éclipse sur le même mécanisme ; le pont avec Zénith ; poser une tâche sur un créneau | — |

---

## 13. Étape 1 : le module existe (27/09/2026)

**La récurrence remontée dans le socle.** `core/lib/recurrence.ts` porte désormais le moteur
d'Éclipse : le type `Recurrence` et `FREQUENCIES`, `ruleDays` (les jours d'une série),
`splitSeries` (« tous les suivants »), `validateRecurrence` et `describeRecurrence` ; et
`core/lib/day.ts` les outils de jours dont il dépend. Le moteur ne connaît plus un événement mais
une **série** (`{ startDay, recurrence }`), ce qu'une tâche répétée est aussi. Éclipse n'en garde
que ce qui est propre à un calendrier : la durée d'un événement, ses exceptions, la traduction
pour FullCalendar. Rien ne change à l'écran : les tests du moteur ont suivi (un de plus, pour la
validation seule), et la suite de bout en bout d'Éclipse passe à l'identique.

**La migration** `supabase/2026-09-27-taches-tables.sql` : `taches_lists` (nom, couleur,
position, archivée) et `taches_tasks`, RLS complet. La base refuse d'elle-même : une heure sans
jour prévu, une répétition sans jour prévu, une fréquence inconnue, une tâche qui serait sa
propre sous-tâche. Supprimer une liste renvoie ses tâches à la boîte de réception ; supprimer une
tâche emporte ses sous-tâches.

**Le contrat** `TachesStore` et ses deux implémentations. `createTask(input, id)` est
**rejouable** : l'identifiant est choisi par l'application, et un second envoi ne crée rien et
rend la première — comme les entrées de Cérès, pour brancher la file hors ligne plus tard sans
migration. Couleurs, priorités, `repeat_from` et fréquences sont des tableaux `as const` comparés
par un test aux contraintes de la migration. La restauration d'une sauvegarde garde les
identifiants (des uuid) : tâches, listes et sous-tâches se retrouvent sans table de
correspondance.

**Le module** `taches`, nom affiché **Polaris**, emoji ⭐, couleur corail `#ff9f7a` (la seule
teinte encore libre dans le hub), un écran signet et un aperçu pour la page d'accueil.

**Migration à appliquer** dans Supabase Studio avant d'utiliser Polaris en mode comptes.

---

## 14. Étape 2 : les règles, testées avant tout écran (28/09/2026)

Quatre bibliothèques pures, 39 tests de plus pour le module, aucun écran.

**`lib/quickAdd.ts` — l'ajout rapide en français, écrit à la main.** `chrono-node` a d'abord été
essayé sur seize phrases de liste de tâches (lundi 28 septembre 2026 comme référence). Il en
comprenait la plupart, mais ratait « le 5 » et « avant le 30 », et surtout lisait
**« après-demain » comme « demain »** : une date fausse, silencieuse — le pire défaut possible
ici. Il embarquait en plus toutes ses langues. L'analyseur maison comprend les seize :

| Tapé | Compris |
|---|---|
| aujourd'hui, ce soir, demain, après-demain | le jour |
| lundi, ce lundi, lundi prochain | le **prochain** lundi, aujourd'hui exclu (dit un lundi : celui de la semaine suivante) |
| la semaine prochaine | le lundi qui vient |
| dans 3 jours, dans deux semaines, dans 1 mois | le jour, chiffres ou lettres |
| le 5, le 1er | ce mois-ci si ce n'est pas passé, sinon le mois suivant |
| le 15 mars, 1er octobre, 3 déc., 3/10, 03/10/2027 | la prochaine fois que ce jour arrive, ou l'année donnée ; « le 31 avril » n'est rien |
| 9h, 9 h 30, à 18h30, 18:30 | l'heure ; seule, elle vaut pour aujourd'hui |
| avant / pour / d'ici / au plus tard + un jour | **l'échéance**, pas le jour prévu |
| ! , !! | importante, urgente (seuls, séparés par des espaces) |
| #maison | la liste dont le nom, sans accents ni espaces, correspond — ou commence ainsi |

Le texte est replié (minuscules, sans accents) **lettre pour lettre**, pour que le titre garde ce
qui a été tapé, majuscules et accents compris. Une seule chose de chaque sorte est retenue ; une
seconde date reste dans le titre. Chaque morceau reconnu est rendu (`tokens`) pour être montré
avant d'enregistrer, et peut être annulé : il retourne alors dans le titre (« Réunion de lundi »).

**`lib/repeat.ts` — cocher.** `nextOccurrence` : à date fixe, le prochain jour de la règle
**après aujourd'hui** (une tâche oubliée trois lundis repart au lundi qui vient, sans trois
retards) ; après l'avoir faite, N jours, semaines, mois ou ans après ce jour-là (31 janvier + 1 mois
= 28 février). `until` et `count` sont respectés, les occurrences oubliées consommées.
`completionPlan` : une tâche simple est notée faite ; une tâche répétée laisse une **copie
terminée** et avance, son échéance décalée d'autant, ses sous-tâches décochées ; la dernière d'une
série est simplement notée faite. Le moteur de règle est celui du socle.

**`lib/views.ts` — les vues.** Aujourd'hui : les retards à part (jour prévu passé ou échéance
dépassée), puis le jour (prévu aujourd'hui, ou échéance dans les 2 jours) — une tâche n'y figure
qu'une fois. L'ordre d'une journée : les heures d'abord, puis la priorité, l'échéance la plus
proche, et l'ordre choisi à la main. À venir : 14 jours, jours vides compris, une échéance sans
jour prévu tombant à son échéance. Boîte de réception (sans liste, datée ou non), liste,
Terminées (par jour, les plus récentes d'abord), sous-tâches.

**`lib/validation.ts`** : les règles de la base en français, plus celles qu'elle ne peut pas
vérifier seule — sous-tâches sur un seul niveau, une sous-tâche ne se répète pas (c'est sa tâche
qui se répète).

---

## 15. Étape 3 : la V1 (28/09/2026)

**L'écran.** En haut, les vues en pastilles — Aujourd'hui (avec son nombre), À venir, Boîte de
réception, puis une pastille par liste, à sa couleur, et « + Liste ». Sur téléphone, elles tiennent
sur une ligne qui défile. La dernière vue ouverte est retenue sur l'appareil (`taches.view.v1`).

**Ajouter.** Une barre toujours visible sous le titre. Ce que l'analyseur a compris s'affiche en
pastilles **avant** d'enregistrer (« 📅 Demain », « ⏰ 9 h », « ⚑ avant le 30 sept. »,
« ! Importante », « # Maison ») ; en toucher une l'annule, le texte retourne dans le titre. Une
tâche s'ajoute là où l'on est : prévue aujourd'hui dans Aujourd'hui, demain dans À venir, dans la
liste ouverte — sauf si le texte a dit autre chose. Si elle se range ailleurs que sous les yeux,
un message dit où (« ajoutée, prévue demain »), pour qu'elle ne semble pas perdue ; la règle
réutilise les fonctions des vues plutôt que de les recopier.

**Les vues.** Aujourd'hui, avec la date en toutes lettres : « En retard » à part s'il y en a, puis
le jour. À venir : quatorze jours, les jours vides en une ligne discrète. Boîte de réception et
listes : l'ordre choisi à la main. Chaque ligne dit ce qui compte d'un coup d'œil — heure, jour
(en rouge s'il est passé), échéance (orange si proche, rouge si dépassée), priorité (qui colore
aussi le rond), liste, répétition ↻, note ✎, et « 1/3 » pour les sous-tâches, qui se déplient.

**Cocher, et défaire.** Cocher retire la tâche de la vue et propose « Annuler » pendant six
secondes. Défaire est calculé comme cocher, par une fonction pure et testée (`undoCompletion`) :
pour une tâche répétée, la copie terminée disparaît, la tâche retrouve son jour, son échéance, sa
règle, et les sous-tâches décochées sont recochées. Les écritures ne forment pas une transaction :
la copie est créée avant que la tâche avance, défaite après qu'elle recule.

**Modifier.** La fenêtre d'une tâche : titre, jour prévu et heure, échéance (derrière « + Ajouter
une échéance », discrète comme décidé), priorité en trois boutons, liste, note, et les
sous-tâches — qui s'ajoutent, se cochent et se suppriment aussitôt, sans attendre
« Enregistrer ». La répétition s'y lit (en toutes lettres) mais se règle à l'étape 4. Supprimer
demande confirmation et dit combien de sous-tâches partent avec. Une liste se crée, se renomme,
change de couleur ; la supprimer renvoie ses tâches à la boîte de réception.

**Deux défauts vus sur les captures, pas par les tests** : un message « ajoutée, dans la boîte
de réception » apparaissait pour une tâche pourtant visible (son échéance proche la faisait
entrer dans Aujourd'hui) — d'où la règle réutilisée des vues ; et les jours vides d'À venir
prenaient le style `.empty` du socle, un grand cadre en pointillés.

**Vérifié** à l'œil sur ordinateur et téléphone ; 35 vérifications de bout en bout.

---

## 16. Étape 4 : répéter, Terminées, réordonner, « Faire le point » (28/09/2026)

**Répéter.** La fenêtre d'une tâche gagne « Répéter », sous le jour prévu : la fréquence, « tous les
N », et le choix qui compte le plus — **« À date fixe »** (tous les lundis, même en retard) ou
**« Après l'avoir faite »** (repart du jour où je la coche). À date fixe, les jours de la semaine
se choisissent en pastilles ; après l'avoir faite, seul l'écart compte. La fin : jamais, à une date,
ou après N fois. La règle se relit en toutes lettres (« 10 jours après l'avoir faite »). Choisir une
répétition sans jour prévu la prévoit aujourd'hui. Les champs sont propres à Polaris, le moteur est
celui du socle.

**Terminées.** Une vue de plus : ce qui a été fait, jour par jour, les plus récentes d'abord — y
compris la copie laissée par une tâche répétée cochée. Décocher y remet une tâche à faire.

**Réordonner une liste.** Une poignée ⠿ devant chaque tâche d'une liste : la glisser, à la souris
ou au doigt (la poignée ne fait pas défiler la page), ou la sélectionner et utiliser les flèches.
Seules les positions qui changent sont écrites (`lib/order.ts`). **Défaut trouvé en vérifiant** :
le glisser s'arrêtait à mi-chemin — la ligne tenue change de place dans la page à chaque pas, et
un élément déplacé perd le suivi du pointeur ; c'est désormais la fenêtre qui écoute le pointeur
pendant le glisser. La boîte de réception garde son ordre calculé (heure, priorité, échéance) : on
y range, on n'y organise pas.

**« Faire le point ».** Dans Aujourd'hui, un bandeau n'apparaît que s'il y a des retards (« 3 tâches
en retard — Faire le point »). La fenêtre les liste, chacune triée d'un geste, et quitte la liste
une fois triée ; elle se ferme quand il n'en reste plus. Le geste agit sur **la date qui a mis la
tâche en retard** (`lib/triage.ts`) : jour prévu passé → aujourd'hui, demain, un autre jour, sans
date ; échéance dépassée → l'échéance est repoussée ou retirée, jamais en silence. Une tâche
répétée en retard ne se déplace pas (ce qui changerait son jour de la semaine ou du mois) : elle
**passe à sa prochaine occurrence**, aujourd'hui compris. Pour toutes : « ✓ Faite » et
« Supprimer ». « Tout pour aujourd'hui » reprévoit d'un coup ce qui peut l'être. Le rappel du
matin viendra avec les rappels (étape 5).

**Vérifié** à l'œil sur ordinateur et téléphone ; 15 vérifications de bout en bout de plus (50 pour
Polaris), dont un vrai glisser à la souris et le nouvel ordre retrouvé après un rechargement.

---

## 17. Étape 5 : les rappels, un mécanisme commun (28/09/2026)

**Le principe : le module calcule, le socle envoie.** Une table commune, `reminders`
(`supabase/2026-09-28-reminders.sql`) : un rappel est un module, une référence stable, un instant,
un titre et un texte. Le contrat du socle gagne une méthode, `scheduleReminders(module, rappels)`,
qui **remplace les rappels à venir** du module par ceux qu'il déclare — une déclaration de ce qui
doit partir, pas une suite d'ordres à rejouer. Un rappel déjà envoyé n'est jamais renvoyé : la clé
unique (compte, module, référence, instant) empêche de le reposer. En mode local, la méthode ne
fait rien : sans serveur, rien ne peut partir.

**L'envoi.** La fonction `send-reminders`, déjà appelée toutes les 5 minutes par pg_cron pour
Zénith, traite aussi la table commune à chaque passage : ce dont l'heure est venue part vers tous
les appareils du compte, puis est marqué envoyé. Un rappel en retard de plus d'une heure (cron
arrêté) est abandonné plutôt qu'envoyé à contretemps ; les rappels envoyés s'effacent après une
semaine. La règle (`moduleReminders.ts`) est pure et testée, comme le chiffrement Web Push. Un
échec de cette partie — table pas encore créée — n'empêche jamais le rappel de Zénith. **Aucun
nouveau cron**, et le serveur ne sait toujours rien des tâches.

**Les rappels de Polaris** (`lib/reminders.ts`, pur et testé), posés sur 7 jours :

- **à l'heure d'une tâche** qui en a une : le titre, « Prévue à 9 h », l'échéance s'il y en a une ;
- **le résumé du matin**, à l'heure choisie, **seulement les jours où il y a quelque chose** :
  « ☀️ 4 tâches aujourd'hui, dont 1 urgente », puis trois titres dans l'ordre de l'écran (les
  retards d'abord) et « et 1 autre ».

Ils sont recalculés à chaque chargement de l'écran et à chaque changement de réglage
(`data/syncReminders.ts`), et redéclarés seulement s'ils ont changé. Les réglages vivent **en
base** (`taches_settings`), pas sur l'appareil : chaque appareil déclare les rappels de tout le
compte, il faut qu'ils partent tous des mêmes réglages. Limite assumée : sans ouvrir Polaris
pendant plus de 7 jours, plus aucun rappel n'est prévu.

**À l'écran.** Réglages → Polaris : « À l'heure des tâches », « Le résumé du matin » et son heure,
et **« Activer les notifications sur cet appareil »** — un petit composant du socle
(`NotificationSetup`), l'abonnement valant pour tous les modules. En mode local, la section dit
seulement que les rappels demandent un compte, comme celle de Zénith.

**Un changement du socle, à connaître.** Couper le rappel quotidien de Zénith **ne désabonne plus
l'appareil** : il aurait coupé du même coup les rappels de Polaris. Le serveur n'envoyait déjà le
rappel quotidien qu'aux profils qui l'ont activé ; « Retirer » dans la liste des appareils reste le
moyen d'en retirer un.

**Mise en place** : appliquer `2026-09-28-reminders.sql` et `2026-09-28-taches-settings.sql`, puis
redéployer `send-reminders` (`docs/rappels-mise-en-place.md`, section ajoutée).

**Pas vérifié de bout en bout** : l'envoi réel demande un vrai compte, un appareil abonné et la
fonction déployée — la suite automatique tourne en mode local. Les règles (quoi envoyer, quand,
quoi abandonner) sont testées ; **à essayer pour de vrai** une fois la fonction redéployée.

---

## Sources

- Tarifs et limites de Todoist en 2026 : [Morgen — Todoist pricing](https://www.morgen.so/blog-posts/todoist-pricing),
  [Carly — Todoist free plan limits](https://www.usecarly.com/blog/todoist-free-plan-limits/),
  [alfred_ — Todoist pricing 2026](https://get-alfred.ai/blog/todoist-pricing)
- `chrono-node`, langues prises en charge et licence MIT : [github.com/wanasit/chrono](https://github.com/wanasit/chrono),
  analyseurs français : [src/locales/fr/parsers](https://github.com/wanasit/chrono/tree/master/src/locales/fr/parsers)
- Rappels, pg_cron et offre gratuite de Supabase : `docs/rappels-mise-en-place.md`
- Calques et services entre modules : `docs/etude-calendrier.md` §6 et §17, `core/lib/services.ts`
