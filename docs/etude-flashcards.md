# Flashcards — étude du troisième module (système de Leitner)

*Étude de conception, écrite avant le code — même exercice que `docs/etude-astra.md` pour
Astra. Objectif : poser le périmètre, le modèle de données et le découpage du chantier avant
d'écrire une ligne. Plusieurs décisions sont volontairement laissées ouvertes en fin de
document — c'est à trancher ensemble, comme les sept questions de
`docs/etude-astra-epargne.md`.*

---

## 1. Ce qui existe déjà, et sur quoi ce module s'appuie

Atlas compte deux modules aujourd'hui : `objectifs` (Zénith, en production) et `budget`
(Astra, V1 livrée). Un troisième suit exactement le même moule — voir `CLAUDE.md` §3 pour la
mécanique d'ajout (dossier, contrat de stockage à deux implémentations, ligne dans le
registre, migration datée) — et hérite **gratuitement** du socle, comme Astra en a bénéficié :
comptes, Row Level Security, synchronisation multi-appareils, réglages, rappels push,
export/import de sauvegarde, hébergement. C'est précisément ce qui rend l'option « module dans
Atlas » plus solide qu'une app séparée : pas de nouveau compte à créer, pas de nouvel
hébergement à payer, pas de sauvegarde à réinventer.

**Ce qui se réutilise vraiment, et comment :**

- Le **motif du conteneur nommé**. Zénith a ses objectifs, ce module aura ses **paquets**
  (« Vocabulaire espagnol », « Anatomie »). Même idée de carte cliquable menant à une liste
  d'éléments, déjà éprouvée par `GoalPicker`/`GoalCard`.
- Les **réglages du panneau commun**, via `AtlasModule.SettingsSection` — le module pourra y
  ajouter les siens (nombre de cartes par session, par exemple) sans toucher au socle.
- Les **rappels push**, génériques dans `core/lib/push.ts` et l'Edge Function
  `send-reminders` : un rappel quotidien à heure fixe existe déjà. Le contenu du message
  (aujourd'hui pensé pour Zénith — à vérifier avant d'y toucher) devra sans doute devenir
  générique le jour où plusieurs modules veulent un rappel qui leur ressemble ; **pas
  nécessaire pour la V1**, qui peut se passer de rappel dédié.

**Ce qui NE se réutilise PAS, malgré l'air de famille — le garde-fou `conventions.test.ts`
l'interdit explicitement (aucun import d'un module vers un autre) :**

- `Heatmap`, `PPChart`, `goalStreak`, `dayString`/`shiftDay` (ces deux derniers vivent même
  dans `objectifs/lib/`, pas dans `core/`). Un futur écran de statistiques du module
  flashcards qui voudrait une grille de jours ou un streak **réécrira sa propre version**,
  même petite. C'est exactement ce qu'a fait Astra pour `SavingsChart` plutôt que de
  réutiliser `PPChart` (journal du 2026-08-25) — la duplication d'une poignée de lignes coûte
  moins cher que le couplage entre modules.
- La **file d'attente hors ligne** (`modules/objectifs/data/outbox.ts`). Elle existe, mais
  `CLAUDE.md` §6 la marque déjà comme *à généraliser* le jour où un second module doit écrire
  en mobilité. Une session de révision de cartes dans les transports ou une salle d'attente
  est justement ce cas d'usage — voir §7.

**Ce qui n'a pas de précédent dans le projet, et qu'il faudra inventer ici :** un moteur de
planification (« quelles cartes revoir aujourd'hui, et où les envoyer selon la réponse »).
Rien dans Zénith ni Astra ne calcule une échéance future à partir d'un état — c'est le vrai
morceau neuf de ce module.

---

## 2. Le système de Leitner, et pourquoi il convient à ce projet

Rappel du principe, pour la suite du document : les cartes sont réparties dans des **boîtes**
numérotées. Chaque boîte a un intervalle de révision qui grandit avec son numéro — la boîte 1
revient tous les jours, la boîte 2 tous les deux ou trois jours, et ainsi de suite. Une carte
correctement rappelée **monte** d'une boîte ; ratée, elle **retombe** en boîte 1. Une carte
n'est due que si son intervalle depuis le dernier passage est écoulé — l'essentiel du système
tient dans cette seule règle.

**Pourquoi Leitner plutôt que SM-2/Anki**, qui est objectivement plus efficace (facteur de
facilité continu, ajusté carte par carte) : SM-2 demande un réglage fin par carte, une échelle
de notation à plusieurs niveaux (pas juste juste/faux), et son bénéfice ne se voit que sur des
milliers de cartes et des mois d'usage. Leitner, lui, est **déterministe et binaire** — une
carte est sue ou ne l'est pas, elle monte ou elle retombe — dans le droit fil de ce que le
projet préfère déjà ailleurs : *« un appui reste un appui »*
(`src/modules/objectifs/lib/quantities.ts`), pas de jugement à trois niveaux là où deux
suffisent. C'est aussi plus facile
à tester exhaustivement (voir §5) et à expliquer en une phrase — cohérent avec `TierKind` ou
les paliers comptables, choisis pour la même raison.

**Anki existe déjà, il est excellent, et il est gratuit.** Le construire dans Atlas n'a de sens
que si le gain dépasse la duplication d'effort. Les raisons qui tiennent : pas de compte
supplémentaire à créer, les données vivent au même endroit que le reste (export/import unique,
même sauvegarde), et le mode hors-ligne local sans compte — gratuit dès le premier jour, sans
même s'inscrire — est déjà acquis par le socle. Les raisons qui ne tiennent pas : la
sophistication de l'algorithme (Anki restera toujours plus précis) ou la richesse des formats
de cartes (audio, images, cartes cloze) — ce module ne cherchera jamais à rivaliser là-dessus.

---

## 3. Le périmètre proposé pour la V1

| Question | Réponse proposée |
|---|---|
| Contenu d'une carte | **Texte recto/verso uniquement.** Pas d'image, pas d'audio, pas de mise en forme |
| Conteneur | **Des paquets**, comme les objectifs de Zénith. Une carte appartient à un seul paquet |
| Algorithme | **Leitner strict, 5 boîtes**, intervalles doublants, retour en boîte 1 sur une réponse fausse (voir §6 pour la discussion boîte dure/douce) |
| Notification dédiée | **Non en V1** — le rappel générique du socle suffit pour commencer |
| Import en masse (CSV/texte collé) | **Hors V1**, comme Astra a différé son import à l'étape 5 |
| Gamification (PP, rangs) | **Hors V1**, décision à reconfirmer plus tard (voir questions ouvertes) |
| Recherche/étiquettes dans les cartes | **Hors V1** — un paquet de moins de quelques centaines de cartes n'en a pas besoin |

**Pourquoi ce périmètre.** Le même raisonnement qu'Astra §1 : la V1 doit être *utilisable
seule* avant d'être *complète*. Un moteur Leitner qui fonctionne, une saisie de cartes qui
marche, un écran de révision honnête — c'est déjà un outil qu'on peut utiliser tous les jours.
Tout le reste (statistiques fines, import, notifications dédiées, éventuelle gamification)
s'ajoute sans migration, comme des lectures supplémentaires du même modèle.

---

## 4. Le modèle de données

Trois tables, préfixées par le nom technique du module (voir §8 pour ce nom), toutes avec
`user_id` et leurs quatre politiques RLS — la convention de `CLAUDE.md`.

### `<prefix>_decks`

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `user_id` | uuid | |
| `name` | text | « Vocabulaire espagnol » |
| `emoji` | text | Pour le repérer d'un coup d'œil dans la liste des paquets |
| `position` | integer | Ordre d'affichage |
| `archived` | boolean | Un paquet terminé (langue apprise) sort de la liste sans perdre son historique |

### `<prefix>_cards`

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `user_id` | uuid | |
| `deck_id` | uuid | |
| `front` | text | Recto — la question |
| `back` | text | Verso — la réponse |
| `box` | integer | **1 à 5**, l'état courant de la carte |
| `due_day` | date | Jour à partir duquel la carte redevient due |
| `created_at` | timestamptz | |

**`box` et `due_day` sont stockés directement, pas recalculés.** C'est le contraire du choix
fait pour les enveloppes d'épargne d'Astra (`docs/etude-astra-epargne.md` §4 : le solde n'est
jamais stocké, toujours recalculé depuis les mouvements). La différence tient au volume et à la
nature de l'opération : le solde d'une enveloppe se recalcule en sommant une poignée de
mouvements à chaque affichage, ce qui reste bon marché même pour beaucoup d'enveloppes. Ici, il
faudrait rejouer **tout l'historique de révision de chaque carte** pour retrouver sa boîte
courante à chaque ouverture de paquet — potentiellement des centaines de cartes, à chaque
rendu. Le système de Leitner est fondamentalement **à état** : la boîte *est* l'état de la
carte, exactement comme `completedAt` sur un palier de Zénith est stocké et non recalculé
depuis les check-ins.

### `<prefix>_reviews` (log, pour les statistiques — voir §6 sur son caractère différable)

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `user_id` | uuid | |
| `card_id` | uuid | |
| `day` | date | Jour de la révision |
| `correct` | boolean | Le résultat |
| `box_after` | integer | La boîte atteinte, pour reconstituer une courbe de progression |
| `created_at` | timestamptz | |

Le rôle de cette table est le même que celui de `checkins` pour Zénith : elle ne pilote rien
en temps réel (`box`/`due_day` sur la carte s'en chargent), elle **nourrit l'historique** —
streak de révision, nombre de cartes vues par jour, courbe de progression d'un paquet dans le
temps. Elle peut être ajoutée à l'étape des statistiques (§9) plutôt qu'à l'étape 1, sans
migration de plus tard : rien dans les deux autres tables n'en dépend.

**`BOX_COUNT` et les intervalles vivent en TypeScript, en tableau `as const`**, avec un test
qui compare le nombre de boîtes à la contrainte `CHECK (box between 1 and N)` de la base — la
même discipline que `TIER_KINDS` (`src/modules/objectifs/lib/types.ts`) et
`src/modules/objectifs/lib/schema.test.ts`. La divergence entre TypeScript et SQL s'est déjà
produite une fois dans ce projet (`compte` manquant côté SQL) ; le test existe pour ne jamais
la revivre.

---

## 5. Le moteur — une bibliothèque pure, testée avant tout écran

Le cœur du module tient dans quelques fonctions sans aucun état React ni appel réseau — même
esprit que `objectifs/lib/quantities.ts` ou `progress.ts` : toute la logique est testable en
lui passant des dates et des cartes, sans navigateur.

```ts
/** Intervalle, en jours, avant qu'une carte de cette boîte redevienne due. */
export const BOX_INTERVALS = [1, 2, 4, 8, 16] as const; // boîte 1 à 5

/** Cartes dues aujourd'hui, dans un paquet donné. */
export function dueCards(cards: Card[], today: string): Card[]

/** Le nouvel état d'une carte après une réponse — pure, ne touche à rien. */
export function applyReview(card: Card, correct: boolean, today: string): Pick<Card, 'box' | 'dueDay'>

/** Répartition des cartes d'un paquet par boîte — pour l'écran de statistiques. */
export function boxDistribution(cards: Card[]): Record<number, number>
```

**`applyReview` est la fonction la plus importante du module, et la plus simple à mal
écrire.** Les cas qu'un test doit couvrir avant tout code d'écran :

- Une réponse juste en boîte *N* (*N* < 5) monte en boîte *N+1*, avec `dueDay = today +
  BOX_INTERVALS[N]`.
- Une réponse juste en boîte 5 **reste en boîte 5** — pas de boîte 6 qui n'existe pas — mais
  avec une échéance repoussée (voir §6, boîte 5 et carte « maîtrisée »).
- Une réponse fausse, quelle que soit la boîte de départ, retombe en boîte 1 avec `dueDay =
  today + BOX_INTERVALS[0]`.
- Deux révisions le même jour sur la même carte : la seconde écrase la première, comme un
  check-in de Zénith (« deux pesées le même matin ne font qu'un point »).

Une fois cette bibliothèque testée de façon exhaustive, l'écran de révision devient un simple
enchaînement d'appels à `dueCards` puis `applyReview` — aucune règle métier n'est écrite dans
un composant, exactement la même séparation que le reste du projet.

---

## 6. Les pièges à ne pas se prendre

**Boîte dure ou boîte douce, en cas d'erreur.** Le Leitner original (les boîtes en carton de
Sebastian Leitner) est « dur » : une carte ratée retombe systématiquement en boîte 1, quelle
que soit la boîte d'où elle vient. Une variante « douce » ne la fait redescendre que d'un
niveau. La version dure est recommandée ici : elle colle à l'original, elle est plus simple à
expliquer et à tester (une seule règle, pas de cas selon la boîte de départ), et elle évite
qu'une carte crue sue depuis longtemps traîne indéfiniment en boîte 4 malgré des erreurs
répétées. **À confirmer — voir questions ouvertes.**

**Une carte « maîtrisée » ne doit jamais disparaître silencieusement.** Une carte qui atteint
la dernière boîte et n'est plus jamais reproposée finit par être oubliée sans que rien ne le
signale — l'inverse du but de l'app. La boîte 5 doit donc garder un intervalle fini (proposé :
32 jours) plutôt que de sortir de la rotation pour toujours.

**Modifier une carte ne doit pas réinitialiser sa boîte.** Corriger une faute de frappe dans un
recto ne veut pas dire « je ne savais pas cette carte » — `box` et `dueDay` ne bougent que sur
une révision, jamais sur une édition. Même principe que « renommer une action ne réécrit pas
l'historique » (`CLAUDE.md` §6, à propos des PP figés).

**Le jour de la coupure.** `dueDay` doit se comparer au jour **local** de l'utilisateur, pas à
un timestamp UTC — sans quoi une carte due « aujourd'hui » à 23h se dérobe pour cause de
décalage horaire. Zénith a déjà ce problème résolu (`dayString`/`shiftDay`,
`objectifs/lib/streak.ts` et `catchup.ts`) ; ce module réécrit sa propre version, courte, plutôt
que d'importer celle d'un autre module (garde-fou `conventions.test.ts`).

**Supprimer un paquet.** `on delete cascade` sur `deck_id` retire ses cartes — comme pour les
enveloppes d'Astra, aucun geste de confirmation en deux temps n'est nécessaire côté base, mais
l'écran, lui, doit confirmer avant d'envoyer la suppression (les cartes ne se recréent pas).

**Une session de révision trop longue décourage.** Un paquet de 300 cartes toutes dues le même
jour (après une semaine d'absence) rendrait la première session interminable. Proposé pour la
V1 : plafonner une session à un nombre raisonnable de cartes (50, par exemple), le reste
attendant le lendemain — un réglage possible dans `SettingsSection` plutôt qu'une constante
figée, si l'usage montre que la valeur par défaut ne convient pas à tous.

---

## 7. Hors ligne — le premier vrai test de l'outbox généralisée

L'outbox actuelle (`modules/objectifs/data/outbox.ts`) existe pour que cocher une action sans
réseau ne perde jamais la coche — le seul bug impardonnable du projet (`CLAUDE.md` §1). Elle
est **encore écrite pour le domaine objectifs**, et `CLAUDE.md` §6 anticipe déjà le jour où un
second module en aura besoin : *« il faudra la généraliser dans `core/` plutôt que la
dupliquer »*.

Une session de révision de cartes est un candidat naturel à ce besoin — plus encore que ne l'a
été Astra jusqu'ici (une dépense se note en général une fois posé, une révision se fait
justement dans les transports, en salle d'attente, n'importe où). Deux chemins possibles pour
ce chantier :

1. **Généraliser l'outbox dans `core/` avant ou pendant ce module** — le travail correct sur le
   fond, mais un chantier à part entière, qui touche un fichier aujourd'hui propre à Zénith.
2. **Écrire une file d'attente propre au module flashcards**, plus rapide, mais qui répète
   exactement la dette que `CLAUDE.md` signale déjà.

**Proposé : ne pas bloquer la V1 dessus.** Les toutes premières étapes (paquets, cartes,
moteur, écran de révision — §9, étapes 1 à 5) peuvent se construire et se tester en supposant
une connexion présente, comme Astra l'a fait jusqu'ici. La généralisation de l'outbox devient
alors une étape déclarée à part, après que le module fonctionne — à trancher explicitement
avant de l'entamer plutôt que d'être décidée en chemin.

---

## 8. Nommer le module — à trancher ensemble

**Nom technique proposé : `flashcards`.** Descriptif, en anglais comme le reste des
identifiants du projet, sans ambiguïté avec un futur module qui parlerait d'autre chose.

**Nom affiché — la famille céleste continue : Atlas porte la voûte, Zénith en est le point le
plus haut, Astra les étoiles.** Deux pistes, chacune avec un lien direct au mécanisme du
module plutôt qu'un nom décoratif :

- **Orbite** — une carte qui revient à intervalle croissant, exactement comme une planète dont
  la période orbitale grandit avec la distance au soleil (boîte 1 = orbite courte, révisée
  tous les jours ; boîte 5 = orbite longue). La métaphore correspond au mécanisme, pas
  seulement au champ lexical — même type de justesse que « Zénith » (le point qu'on atteint en
  gravissant les rangs) ou « Astra » (beaucoup de petites choses, comme beaucoup de petites
  dépenses).
- **Polaris** — l'étoile polaire, le repère fixe vers lequel on revient toujours se recaler.
  Moins précis sur le mécanisme (pas d'idée de fréquence croissante), mais une image plus
  immédiatement lisible.

**Recommandation : Orbite**, pour la justesse de la métaphore. À confirmer avec toi comme les
autres noms l'ont été (journal du 2026-08-09).

---

## 9. Découpage du chantier

| # | Étape | Ce qu'elle livre |
|---|---|---|
| 1 | Migration (`decks` + `cards`, sans `reviews`) + contrat de stockage + deux implémentations | Le module existe, vide, et passe `conventions.test.ts` |
| 2 | Paquets : créer, renommer, archiver, écran de liste | On peut ranger |
| 3 | Cartes : créer, éditer, supprimer, dans un paquet | Le contenu existe |
| 4 | Moteur Leitner (`dueCards`, `applyReview`, `boxDistribution`) + tests exhaustifs, sans écran | La règle est correcte avant d'être affichée |
| 5 | Écran de révision : file du jour, retourner la carte, juste/faux | Le module devient utilisable seul — la V1 est atteinte |
| 6 | Statistiques : table `reviews`, répartition par boîte, streak de révision | La mémoire du travail accompli, comme la grille de Zénith |
| 7 | (Plus tard, à décider séparément) Généralisation de l'outbox, rappel dédié, import en masse | Ce qui rend l'usage tenable dans la durée, comme l'import CSV l'a fait pour Astra |

Les étapes 1 à 5 ne dépendent d'aucune décision encore ouverte à la marge — seuls le nom du
module (§8) et le détail boîte dure/douce (§6) doivent être tranchés avant l'étape 1, parce
qu'ils touchent le nom des tables et la fonction `applyReview` respectivement.

**Chaque étape est un commit, avec `npm run test` et `npm run check` au vert** — la même
règle que pour Astra.

---

## 10. Questions ouvertes à trancher ensemble

1. **Nom du module** (§8) — `Orbite`, `Polaris`, ou une autre proposition.
2. **Boîte dure ou douce** en cas de réponse fausse (§6) — dure recommandée.
3. **Nombre de boîtes et intervalles** — 5 boîtes, intervalles `1, 2, 4, 8, 16` puis 32 jours en
   boîte 5, ou une autre échelle si tu as une préférence issue d'un usage antérieur d'Anki ou
   d'un Leitner physique.
4. **Généraliser l'outbox maintenant ou plus tard** (§7) — proposé : plus tard, en étape
   déclarée à part.
5. **Gamification (PP, rangs)** — hors V1 confirmé, mais à la différence d'Astra (des dépenses
   subies, où les PP culpabiliseraient), apprendre est un effort choisi, du même ordre qu'un
   objectif de Zénith. Vaut-il la peine de le prévoir pour plus tard, ou ce module doit-il
   rester délibérément hors du système de rangs ?
6. **Taille maximale d'une session de révision** (§6) — 50 cartes par défaut, réglable ou fixe.

---

## 11. Décisions prises avec Jules (30/08/2026)

| # | Question | Réponse |
|---|---|---|
| 1 | Nom du module | **Orbite** |
| 2 | Boîte dure ou douce | **Dure** — une réponse fausse retombe en boîte 1, quelle que soit la boîte de départ |
| 3 | Boîtes et intervalles | **5 boîtes, `1, 2, 4, 8, 16` jours, 32 jours en boîte 5** — confirmés tels que proposés |
| 4 | Généralisation de l'outbox | **Plus tard** — la V1 (étapes 1 à 6) se construit en supposant une connexion présente |
| 5 | Gamification (PP, rangs) | **À voir plus tard** — ni tranché pour, ni tranché contre ; le module reste hors du système de rangs tant que la question n'est pas revenue sur la table |
| 6 | Taille de session | **50 cartes**, en constante fixe pour l'instant — pas un réglage exposé tant que l'usage ne dit pas si 50 convient |

Toutes les questions ouvertes de §10 sont donc tranchées. Le chantier peut commencer à
l'étape 1 (§9).

---

## 12. Visibilité du jour (post-V1, 30/08/2026)

Retour de Jules une fois la V1 (étapes 1 à 5) livrée : rien ne dit, à l'ouverture d'Orbite, ce
qu'il y a à réviser aujourd'hui. Il faut ouvrir chaque paquet un par un pour le découvrir — ce
que le bouton « Réviser (N) » de l'étape 5 permettait déjà, mais seulement une fois *dans* un
paquet.

**Ce qui a été ajouté**, sans toucher au modèle de données ni au moteur (§4, §5) :

- Un **bandeau « Aujourd'hui »**, en tête de l'écran des paquets : le nombre total de cartes
  dues, tous paquets actifs confondus, avec un bouton « Réviser » qui ouvre directement une
  session. Rien à zéro n'est pas caché : un paquet à jour affiche « Tout est à jour, rien à
  réviser aujourd'hui » plutôt que de faire disparaître le bandeau — la question « qu'en est-il
  aujourd'hui ? » reçoit toujours une réponse visible, y compris quand elle est bonne.
- Une **pastille d'échéance** sur chaque paquet de la liste, visible seulement s'il a des
  cartes dues (pas de bruit sinon) — pour situer *où* réviser sans avoir à cliquer.
- `ReviewSession` généralisée : elle ne connaît plus « un paquet » mais un titre (le nom d'un
  paquet, ou « Aujourd'hui ») et une file de cartes qui peuvent venir de plusieurs paquets. Une
  étiquette discrète au-dessus de chaque carte rappelle alors sa provenance, pour ne pas
  mélanger espagnol et anatomie sans repère.

**Ce qui n'a pas changé** : la file d'une session « Aujourd'hui » suit exactement la même règle
qu'une session de paquet — `dueCards` puis `SESSION_LIMIT`, sur l'ensemble des paquets actifs
(un paquet archivé ne réclame rien). Aucune nouvelle méthode de stockage : `listCards()`
renvoie déjà tout, `FlashcardsScreen` filtre par paquet côté client, comme `DeckDetail` le
faisait déjà pour un seul.

---

## 13. Visibilité par boîte (post-V1, 30/08/2026)

Deuxième retour de Jules, le même jour : « on ne sait pas quelle carte est bientôt finie,
qu'est-ce qu'il y a dans la boîte 1, la boîte 2 etc. ». C'est le fragment « répartition par
boîte » de l'étape 6 (§9), tiré en avant — `boxDistribution` existait déjà depuis l'étape 4,
il ne manquait qu'un écran par-dessus.

**Ajouté à `DeckDetail`, sans toucher au modèle de données :**

- **`BoxDots`** : chaque carte affiche sa boîte en points pleins/vides (●●●○○ pour une boîte 3
  sur 5), plutôt qu'un numéro ou une légende à apprendre — plus il y a de points pleins, plus
  la carte est proche de la maîtrise. Répond directement à « quelle carte est bientôt finie ».
- **Un filtre par boîte**, avec l'effectif de chacune (`Boîte 3 (4)`), sur le même motif que le
  filtre par action de la grille de Zénith (`Heatmap`, `.heat-chip`/`.heat-filter`) — même
  idée, réécrite ici plutôt qu'importée (un module n'importe jamais d'un autre). Cliquer une
  boîte montre son contenu ; une boîte vide le dit plutôt que de ne rien afficher.
- Créer une carte réinitialise le filtre à « Toutes » : une carte neuve naît en boîte 1
  (`docs/etude-flashcards.md` §4), rester sur un autre filtre la rendrait invisible sans
  explication.

**Ce qui reste pour l'étape 6 complète** : le streak de révision et l'historique dans le
temps, qui ont besoin de la table `flashcards_reviews` (encore non créée) pour reconstituer
autre chose que l'état courant des cartes.

### La même vue, agrégée sur l'écran principal (30/08/2026)

Troisième retour de Jules, le même jour : « on ne voit que les boîtes pour un paquet en
particulier » — et la demande de la voir aussi sur l'écran principal, « comme dans un paquet
particulier au final ». `FlashcardsScreen` reprend donc le même filtre par boîte, mais agrégé
sur `reviewableCards` (tous les paquets actifs, comme le bandeau « Aujourd'hui » — un paquet
archivé ne compte pas). Choisir une boîte déplie une liste de ses cartes, chacune étiquetée du
paquet dont elle vient ; cliquer une carte ouvre directement ce paquet, pour aller la réviser
ou la modifier là où elle vit vraiment. La liste des paquets, elle, reste toujours visible en
dessous — le filtre par boîte ne la remplace pas, il s'ajoute au-dessus.

---

## 14. Statistiques, sans streak (post-V1, 30/08/2026)

Quatrième retour de Jules, le même jour, sur la statistique de streak envisagée dans le
découpage d'origine (§9, étape 6) : « est-ce que la streak de révision est pertinente ? car
certains jours il n'y aura rien à réviser ». L'objection tient : contrairement à une action de
Zénith, toujours disponible, la file du jour d'Orbite est décidée par l'algorithme, pas par la
discipline de l'utilisateur — un jour à zéro carte due n'est pas un jour manqué, et un streak
qui compterait « as-tu fait quelque chose » le punirait pour avoir justement bien réparti ses
révisions.

**Décision : pas de streak pour l'instant.** L'étape 6 se limite au volume et à la réussite —
deux statistiques qui restent vraies quel que soit le remplissage de la file. Une version
« conditionnelle » du streak (compte comme tenu un jour sans rien à réviser, casse seulement un
jour où des cartes dues n'ont pas été faites) a été évoquée comme piste, pas retenue pour
l'instant — à reprendre si le besoin revient.

**Ajouté** : la table `flashcards_reviews` (le journal — jour, résultat, boîte atteinte),
`reviewCard` qui l'écrit en plus de l'état de la carte (avec `correct` fourni explicitement par
l'appelant, jamais déduit de `patch.box`, pour ne pas faire fuiter la règle du Leitner dans le
contrat de stockage), et un panneau **Statistiques** (`StatsPanel`) accessible depuis l'écran
principal : le total de révisions, celles des sept derniers jours, le taux de réussite. Rien à
zéro n'est caché : sans aucune révision, le panneau le dit plutôt que d'afficher des zéros nus.

**Un bug découvert en testant cette étape, corrigé au passage** : revenir d'un paquet
(`DeckDetail`) vers l'écran principal ne rafraîchissait pas l'état de ce dernier — le bandeau
« Aujourd'hui », les pastilles par paquet et la répartition par boîte restaient figés sur ce
qu'ils étaient à l'ouverture du paquet, même après y avoir révisé, ajouté ou supprimé des
cartes. `onBack` déclenche maintenant `refresh()`. Il était resté invisible jusqu'ici parce
qu'aucune vérification n'enchaînait une vraie révision suivie d'un retour à l'écran principal.

---

## 15. Import en masse (étape 7, 30/08/2026)

Dernier morceau de l'étape 7 (§9) livré, à la demande de Jules — sans l'outbox (jugée pas
nécessaire pour l'instant) ni le rappel dédié. « L'usage devient tenable dans la durée » sans
ouvrir l'éditeur de carte un par un.

**Le format retenu, plus simple que l'import CSV bancaire d'Astra** : une carte par ligne,
recto puis verso, séparés par un point-virgule ou une tabulation — les deux acceptés, pas un
seul, pour qu'un texte tapé à la main (« Hola ; Bonjour ») et un collage depuis un tableur ou
un export d'une autre appli de cartes (tabulations) marchent tous les deux sans réglage à
choisir. Seul le premier séparateur d'une ligne compte : un point-virgule dans le verso
(« Bonjour ; salut informel ») ne casse rien.

**Aperçu avant écriture**, comme l'import CSV : le nombre de cartes nouvelles, le nombre de
lignes incomprises (affichées, pas juste comptées, pour qu'on puisse les corriger et recoller),
et le nombre de cartes déjà présentes dans le paquet (même recto, à la casse et aux espaces
près) — écartées plutôt que dupliquées, pour qu'on puisse recoller une liste sans relire ce qui
a déjà été fait. Rien n'est créé tant qu'on n'a pas cliqué « Importer ».

**Ce que ce format ne fait pas** : pas de troisième colonne (paquet, boîte de départ…) — toutes
les cartes importées vont dans le paquet ouvert, naissent en boîte 1, comme une création à
l'unité. Pas de détection de doublon inter-paquets non plus, seulement dans le paquet où on
importe : recoller la même liste dans un autre paquet créerait bien des cartes redondantes,
volontairement — deux paquets peuvent légitimement vouloir la même carte.

**Étape 7 maintenant close** pour ce qui a été demandé : outbox écartée, rappel dédié non
demandé, import en masse livré. Rien d'autre n'est en attente dans le découpage d'origine.

---

## 16. Rendu mobile (31/08/2026)

Le découpage complet livré, Jules a demandé une revue de ce qui pourrait être amélioré ; le
rendu mobile n'avait, contrairement à Zénith et Astra, **jamais été vérifié** — toutes les
suites e2e d'Orbite tournaient en viewport bureau. Vérification demandée, deux vrais bugs
trouvés et corrigés.

**Le bug le plus net : trois boutons dans la barre du haut** (Modules, Statistiques, Réglages)
ne tenaient pas sur un écran de 390 px. `.main` (le socle) n'a pas de largeur explicite sur
mobile ; sans elle, un contenu plus large que le viewport l'étire au lieu d'être contraint —
exactement le mécanisme déjà rencontré et documenté pour Zénith le 24/08/2026 (`CLAUDE.md`),
mais jamais déclenché côté Astra ou Zénith parce que leurs barres du haut n'ont jamais porté
plus de deux boutons. Le bouton Statistiques ajouté à l'étape 6 en fait un troisième — assez
pour dépasser.

**Corrigé en reprenant le motif déjà établi par Zénith** (`.topbar-settings` du socle) plutôt
qu'en inventant autre chose : sous 760px, le texte de chaque bouton disparaît (icône seule),
avec un `aria-label` explicite sur le `<button>` pour que le nom accessible survive à la
disparition du texte visible — sans lui, un bouton dont tout le contenu est soit caché
(`display: none`) soit exclu (`aria-hidden`) n'a plus de nom du tout, ce qui a d'ailleurs cassé
le premier essai (un clic sur « Statistiques » ne trouvait plus le bouton).

**Le deuxième bug, plus classique** : les lignes de paquet, de carte et d'archive
(`.flashcards-row`) ne prévoyaient aucun repli sous 480px — nom, pastille et trois boutons
d'action sur une seule ligne sans retour, débordant dès qu'un nom de paquet dépasse quelques
caractères. Corrigé sur le motif déjà utilisé par Astra (`.budget-entry-row`) : les actions
repassent sur leur propre ligne, alignées à droite. Le recto et le verso d'une carte, côte à
côte sur grand écran, s'empilent aussi en dessous de 480px.

**Un bug sans rapport, découvert en chemin** : un test unitaire (`localFlashcards.test.ts`)
comparait `dueDay` (calculé en heure locale) à `new Date().toISOString().slice(0, 10)` (en
UTC) — les deux peuvent diverger selon le fuseau, et ce jour-là ils divergeaient réellement
(le calendrier a changé de jour pendant la session). Corrigé pour comparer contre `dayString()`,
la même fonction que le code testé.

`473/473` tests unitaires (inchangé, uniquement du CSS et de la structure de bouton — sauf le
correctif de date ci-dessus, qui ne change aucun compte), `365/365` local → `373/373` (+8 :
absence de débordement sur cinq écrans, icônes seules sur la barre du haut, noms accessibles
malgré le texte caché), `377/377` en mode comptes → `385/385` (+8).

## 17. Mise en forme légère du recto/verso (post-V1, 12/09/2026)

§3 excluait toute mise en forme de la V1 (« texte seul »). Demande de Jules après coup : « je
veux pouvoir faire du markdown : je veux pouvoir faire des listes, souligner, surligner ». Trois
règles seulement, pas du Markdown/CommonMark complet — `__texte__` y voudrait dire gras, pas
souligné, et rien n'était demandé au-delà de ces trois usages :

| Syntaxe | Effet |
|---|---|
| Une ligne commençant par `- ` ou `* ` | Item de liste (`<li>`) |
| `__texte__` | Souligné (`<u>`) |
| `==texte==` | Surligné (`<mark>`) |

**Aucune migration, aucune méthode de stockage nouvelle** : `front`/`back` restent de simples
chaînes (`lib/types.ts`) — cette syntaxe n'existe que dans l'interprétation qu'on en fait à
l'affichage, exactement comme un import CSV d'Astra ne change rien au schéma de ses tables.

**Bibliothèque pure d'abord** (`lib/richText.ts`, testée avant tout écran, même discipline que
`lib/boxes.ts`) : `parseInlineSpans` coupe une ligne en portions marquées ou nues,
`parseRichText` classe chaque ligne du texte en item de liste ou texte simple. Pas de notion de
paragraphe (une ligne vide ne fusionne rien) : une carte est un texte court, chaque ligne
d'origine reste une ligne affichée — ce que faisait déjà le `white-space: pre-wrap` qu'elle
remplace, désormais porté par une structure de blocs explicite (`RichText.tsx`) plutôt que par
du CSS sur du texte brut, pour ne jamais construire de HTML à partir d'une chaîne
(`dangerouslySetInnerHTML` n'existe nulle part dans Atlas, et ce n'était pas le moment de
l'introduire).

`RichText` (composant, pas bibliothèque pure — il rend du JSX) est utilisé aux trois seuls
endroits qui affichaient jusqu'ici du texte brut : la liste des cartes d'un paquet
(`DeckDetail`), la liste agrégée par boîte (`FlashcardsScreen`), et l'écran de révision
(`ReviewSession`). `CardEditor` gagne un aperçu qui se met à jour à la frappe (un `<textarea>`
ne peut pas afficher lui-même du gras ou une puce) et un rappel de la syntaxe en `.field-hint`
(classe déjà partagée par le socle) — sans ça, personne ne devine `==texte==` sans lire ce
document.

`554/554` tests unitaires → `566/566` (+12 : `lib/richText.test.ts`), `460/460` local →
`462/462` (+2 : liste/souligné/surligné visibles dans l'aperçu de l'éditeur puis dans la liste
des cartes une fois enregistrés), `472/472` en mode comptes → `474/474` (+2).

## 18. Boutons d'aide à la rédaction (post-V1, 13/09/2026)

§17 rendait la syntaxe, mais ne donnait aucun moyen de l'écrire sans la taper à la main. Jules,
le lendemain : « on peut afficher du texte markdown mais est-ce qu'il y a les petits outils
d'aide à la rédaction qui permettent de mettre en gras, faire une liste, souligner… ? » — « mettre
en gras » n'existait pas encore, §17 n'ayant retenu que liste/souligné/surligné. Ajouté ici
plutôt que refusé : une quatrième marque était de toute façon nécessaire pour que les boutons
couvrent ce qui était demandé.

**Le gras (`**texte**`) rejoint les trois marques existantes** dans `lib/richText.ts` — la
seule des quatre qui coïncide avec CommonMark, l'occasion étant bonne puisqu'aucune autre
marque n'utilisait encore `*`. `RichSpan` gagne `bold?: boolean`, rendu par un `<strong>` dans
`RichText.tsx`. `isListLine` (le test qui reconnaît une puce) est exporté de `richText.ts`
plutôt que dupliqué : `lib/textEditing.ts` (§18) en a besoin pour savoir si une ligne est déjà
une liste avant de basculer.

**Deux fonctions pures, testées avant l'écran** (même discipline que `lib/boxes.ts` et
`lib/richText.ts`), dans `lib/textEditing.ts` :

- `wrapSelection(text, start, end, marker)` entoure la sélection de la marque des deux côtés ;
  sans sélection, insère la paire vide et place le curseur entre les deux pour taper directement
  dedans. Ré-appliquer sur un texte déjà entouré **retire** la marque (bascule) — un même bouton
  met en forme et défait, comme n'importe quel éditeur de texte enrichi.
- `toggleListPrefix(text, start, end)` ajoute ou retire `- ` sur chaque ligne du bloc touché par
  la sélection ; bascule vers le retrait seulement quand **toutes** les lignes non vides du bloc
  sont déjà des puces — un bloc mixte devient entièrement puce, jamais l'inverse à la première
  pression.

**`FormatToolbar.tsx`**, un composant par `<textarea>` (recto et verso en ont chacun un),
applique ces fonctions sur la sélection courante du champ puis restaure le focus et la position
du curseur — un changement de `value` piloté par état ne le fait pas tout seul, et sans cette
restauration chaque clic aurait fait perdre la position d'écriture. La sélection est lue sur
l'élément DOM (`textareaRef.current.selectionStart/End`) au moment du clic : elle survit au
transfert de focus vers le bouton, ce n'est donc pas un problème que le clic déplace
momentanément le focus.

Boutons : « G » en gras pour Gras, « S » soulignée pour Souligner, un émoji 🖍 pour Surligner
(un « S » pour souligner et un « S » pour surligner se seraient confondus), « • Liste » en toutes
lettres. Le rappel de syntaxe sous le verso reste affiché, pour qui préfère taper directement.

`566/566` tests unitaires (après §17) → `580/580` (+14 : gras et `isListLine` dans
`richText.test.ts`, `lib/textEditing.test.ts` en entier), `462/462` local (après §17) →
`465/465` (+3 : gras et liste appliqués depuis les boutons, rendus dans l'aperçu puis dans la
carte enregistrée), `474/474` en mode comptes (après §17) → `477/477` (+3).

## 19. §17-§18 remplacés par un éditeur riche (Tiptap), 13/09/2026

Un jour après §18, Jules essaie les boutons et revient avec deux défauts concrets : « il faut
sélectionner un texte pour que ça marche [pour la liste], et si je fais entrée ça continue pas
la liste ». Demande : « je préférerai une bibliothèque ». Le texte-brut-avec-syntaxe (§17) et
ses boutons de manipulation de sélection (§18) sont **entièrement retirés** — `lib/richText.ts`,
`lib/textEditing.ts` et `FormatToolbar.tsx`, jamais committés, simplement supprimés plutôt que
dépréciés.

**Bibliothèque choisie : Tiptap** (`@tiptap/react`, `@tiptap/starter-kit`,
`@tiptap/extension-highlight`, `@tiptap/extension-placeholder`), pas react-quill — react-quill
manipule le DOM lui-même (`findDOMNode`, retiré de React 18+) et n'a pas de fork officiellement
maintenu pour React 19 ; Tiptap déclare React 19 dans ses `peerDependencies` (v3.31.3, vérifié
avant d'installer). Licence MIT, gratuite — respecte la contrainte n°1 de ce document (§1).
**Coût réel, à ne pas cacher** : le JS minifié gzippé passe de 186 ko à 310 ko (ProseMirror,
sur lequel Tiptap s'appuie, n'est pas petit) — accepté sans discussion à ce stade, aucune
contrainte de volumétrie n'existe pour une appli personnelle sur Cloudflare Pages, mais à garder
en tête si `npm run build` alerte un jour sur la taille du bundle pour de bon.

**Le recto/verso devient du HTML**, plus la syntaxe maison de §17 — `front`/`back` restent des
chaînes (aucune migration), mais leur contenu est écrit par l'éditeur (`editor.getHTML()`) et
affiché tel quel. `RichText.tsx` (le composant de rendu, gardé) passe de « interpréter une
syntaxe » à « faire confiance à du HTML » : premier `dangerouslySetInnerHTML` d'Atlas, jugé sûr
ici parce que ce HTML ne peut sortir que du schéma restreint de l'éditeur (§ci-dessous) — jamais
d'une saisie brute copiée telle quelle, jamais de `<script>` possible tant que rien n'ouvre le
schéma à du contenu arbitraire.

**Schéma volontairement restreint** : `StarterKit.configure({...})` désactive tout ce qu'aucun
bouton ne propose (titres, citation, code, lien, liste numérotée, italique, barré) — un schéma
plus large que les boutons qui l'exposent serait un piège (un raccourci clavier ferait
apparaître un titre qu'aucun bouton ne pourrait retirer). Restent : gras, souligné (déjà dans
`StarterKit` en v3, plus besoin de l'ajouter à part), liste à puces, plus `Highlight` (surligné,
absent de `StarterKit`) et `Placeholder` (texte d'exemple dans le champ vide, équivalent du
`placeholder` d'un `<textarea>`).

**`EditorToolbar.tsx`** remplace `FormatToolbar.tsx` : les boutons appellent directement les
commandes Tiptap (`editor.chain().focus().toggleBold().run()`…) au lieu de manipuler du texte à
la main, et `useEditorState` (l'API que Tiptap recommande pour ça) tient l'état « actif » de
chaque bouton synchronisé avec la position du curseur — un clic sans rien sélectionner met en
forme ce qui va être tapé ensuite, exactement ce que §18 ne savait pas faire pour la liste.
**Entrée continue une liste nativement** (`ListKeymap`, dans `StarterKit`) : le deuxième défaut
signalé par Jules disparaît sans code à écrire, c'est le comportement de base d'un éditeur
structuré (une liste est un vrai nœud du document, pas une ligne qui commence par `- `).

**Un vrai bug trouvé et corrigé en écrivant la suite e2e**, pas seulement un souci de test :
cliquer un bouton de la barre déplace le focus du navigateur dessus (comportement natif d'un
`<button>`) ; `editor.chain().focus()` est censé le redonner à l'éditeur, et le fait bien tant
qu'un seul éditeur Tiptap existe sur la page — mais avec **deux** éditeurs (recto et verso), une
fois que l'un des deux a été focus au moins une fois, ce retour de focus après un clic sur
l'autre devient peu fiable. Conséquence concrète, reproduite : cliquer « Liste » sur le verso
juste après avoir touché le recto, puis taper « vino » — le focus restait sur le bouton, les
lettres ne faisaient rien, et l'espace de « vino » **réactivait le bouton** (un `<button>` répond
nativement à la touche Espace), défaisant la liste qu'on venait de poser. Corrigé par le motif
standard des barres d'outils de texte riche : `onMouseDown={(e) => e.preventDefault()}` sur
chaque bouton, pour que le focus ne quitte jamais l'éditeur — plus fiable que de compter sur
Tiptap pour le lui rendre après coup. Sans la suite e2e (qui enchaîne volontairement recto puis
verso, comme un vrai usage), ce bug serait resté invisible en usage occasionnel à un seul champ
à la fois.

`554/554` tests unitaires (après §17-§18) → `554/554` (`richText.test.ts` et
`textEditing.test.ts`, 26 tests, supprimés avec les fichiers qu'ils couvraient — rien à tester
« à la main » sur une bibliothèque déjà testée par ses propres mainteneurs), `465/465` local
(après §18) → `464/464` (la vérification sur l'aperçu séparé disparaît, l'éditeur riche EST
l'aperçu ; deux vérifications plus complètes la remplacent, dont celle qui aurait attrapé le bug
de focus ci-dessus), `477/477` en mode comptes (après §18) → `476/476`.

## 20. Palette élargie : italique, barré, code, liste numérotée (13/09/2026)

Question de Jules après §19 : « pourquoi y'a que 4 options de markdown ? » — réponse : parce que
c'était exactement ce qui avait été demandé mot pour mot (§17 : liste/souligné/surligné, §18 :
plus le gras), pas une limite technique. Demande immédiate : « rajoute quelques éléments souvent
utilisés ». Choisis pour un recto/verso de carte, pas pour un document long : **italique**,
**barré**, **code en ligne** (utile pour du contenu technique — Jules développe), **liste
numérotée** (le pendant naturel de la liste à puces). Laissés de côté, jugés rares sur une
carte courte : titres, citation, lien, règle horizontale.

Coût quasi nul : `italic`, `strike`, `code`, `orderedList` étaient déjà dans `StarterKit`,
simplement désactivés en §19 — il a suffi de retirer leur `: false` dans
`bodyExtensions` (`CardEditor.tsx`) et d'ajouter les quatre boutons correspondants dans
`EditorToolbar.tsx` (tableau `BUTTONS`, déjà piloté par une liste plutôt que par du JSX répété —
le passage de 4 à 8 boutons n'a touché que ce tableau, aucune structure à changer). Étiquettes à
une lettre choisies pour ne jamais se confondre : G (Gras), I (Italique), S (Souligner), B
(Barré) — chacune stylée pour montrer son propre effet, comme les boutons déjà en place. Le
code exclut nativement les autres marques dans le schéma ProseMirror (un span de code n'est
normalement ni gras ni souligné) : non re-testé explicitement, comportement par défaut de
l'extension `Code`, pas une règle écrite ici.

`.flashcards-format-toolbar` gagne `flex-wrap: wrap` — huit boutons sur une largeur de modal
mobile ne tiennent pas forcément sur une seule ligne, une deuxième ligne est plus sûre qu'un
débordement horizontal.

`554/554` tests unitaires (inchangé, aucune nouvelle logique pure — les nouvelles marques
viennent telles quelles de Tiptap), `464/464` local → `466/466` (+2 : italique/barré cumulés au
gras, code et liste numérotée), `476/476` en mode comptes → `478/478` (+2).

## 21. Aperçu tronqué dans la liste d'un paquet (13/09/2026)

Jules, sur l'affichage des cartes dans un paquet : « pas du tout correct, j'ai souvent des
longues réponses et ça rend très moche, il faut recentrer certains éléments et surtout ne pas
afficher toute la réponse... juste le début et peut-être l'afficher entier si on clique sur
modifier ou même en tooltip ». Le second point (« Modifier ») était déjà acquis — l'éditeur
charge toujours le contenu complet ; restait à tronquer l'aperçu de la liste et infobuller le
reste.

**Le HTML lui-même n'est pas tronqué** — couper une chaîne HTML au milieu casserait des balises
ouvertes. `lib/htmlPreview.ts` (bibliothèque pure, testée avant l'écran, même discipline que
`lib/richText.ts`) réduit le HTML en texte simple (`htmlToPlainText` — les balises de bloc
`p`/`div`/`li`/`br` deviennent une espace, pour ne pas coller deux mots de blocs différents),
puis coupe à 70 caractères sur la dernière frontière de mot (`truncatePreview`). Le composant
`CardPreview.tsx` affiche ce texte tronqué dans un `<span title={texte complet}>` — l'infobulle
native du navigateur, sans bibliothèque ni composant à construire, exactement la deuxième option
proposée par Jules. `RichText.tsx` (affichage intégral, mis en forme) reste utilisé là où le
texte complet a sa place : l'écran de révision, où lire toute la réponse est le but même de
l'écran.

**« Recentrer certains éléments »** : `.flashcards-card-row { align-items: flex-start; }`
existait pour ne pas couper le haut d'une réponse multi-lignes (§17-§18, quand le verso pouvait
être un vrai bloc de texte formaté). Avec l'aperçu ramené à une seule ligne tronquée, cette
raison d'être disparaît — la règle est retirée, la ligne retrouve le centrage vertical de
`.flashcards-row` (points de boîte, recto, verso, boutons alignés au milieu). Une deuxième
sécurité, en CSS pur cette fois, en plus de la coupe à 70 caractères : `overflow: hidden;
white-space: nowrap; text-overflow: ellipsis` sur `.flashcards-card-front`/`-back` et
`.flashcards-row-name` (l'aperçu agrégé par boîte, `FlashcardsScreen.tsx`, avait le même risque
avec un recto long) — si l'estimation en caractères ne correspond pas exactement à la largeur
réelle du conteneur sur un écran étroit, l'ellipse CSS referme proprement, sans jamais déborder.
Le repli mobile qui empilait recto/verso chacun sur sa propre ligne (`@media max-width: 480px`)
n'a plus de raison d'être non plus, pour la même raison : retiré, ils tiennent maintenant
côte à côte à toute largeur.

`554/554` tests unitaires → `564/564` (+10 : `lib/htmlPreview.test.ts`), `466/466` local →
`468/468` (+2 : une réponse longue tronquée dans la liste, texte complet retrouvé en infobulle),
`478/478` en mode comptes → `480/480` (+2).
