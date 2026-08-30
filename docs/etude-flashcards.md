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
