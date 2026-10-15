# Le détail des courses dans Budget — étude

> Demande de Jules (14/10/2026) : « Mixte avec Budget : pouvoir voir le détail des budgets courses
> par grande typologie d'achat (nourriture, hygiène…) et peut-être encore plus précis, par exemple
> dans nourriture : nécessaire, apéritif… Fais déjà une étude. »
>
> Rien n'est construit. Cette étude dit ce qui existe, ce qui manque, ce que je propose, et les
> questions à trancher (§9) avant d'écrire une ligne.

## 1. Ce que la demande veut dire

Aujourd'hui, Budget dit **combien** part en courses (la catégorie « Courses » : 503,85 € sur les
17 opérations rangées là). Il ne dit pas **en quoi** : combien de nourriture, combien d'hygiène,
combien d'entretien, et dans la nourriture, combien d'essentiel et combien de plaisir (l'apéro, les
sucreries, l'alcool). C'est la question « où part l'argent des courses ? », et ensuite « est-ce que ça
change d'un mois à l'autre ? ».

## 2. Ce qui existe déjà (vérifié dans le code et dans tes données, en lecture seule)

**Courses connaît chaque ligne d'un ticket** : nom, quantité, prix payé, et un **rayon** parmi
treize (`AISLES` : fruits et légumes, boulangerie, crèmerie, boucherie-poissonnerie, épicerie
salée, épicerie sucrée, surgelés, boissons, hygiène, entretien, bébé, animaux, autre), deviné d'après
le nom (`guessAisle`) et figé dans la course (`courses_trip_items.aisle`).

**Budget reçoit une seule opération par course** (« Courses — Auchan », −38,84 €, référence
`comete:course:<n>`), et l'import du relevé ne la compte pas deux fois (`moduleMatch`).

**Ce que disent tes données aujourd'hui** :

| | |
|---|---|
| Courses enregistrées dans Courses | **2** (10 et 13 octobre), avec **toutes leurs lignes prix compris** (18 lignes), venues de tickets lus par Claude — total des lignes = total des tickets, au centime |
| Opérations « Courses » dans Budget | **17**, dont **15 sans aucun détail** (relevés importés, saisies à la main, « Feuillette », un remboursement) |

Deux enseignements :

1. **Le détail n'existe que pour les courses passées par Courses** (ticket, ou liste cochée avec ses
   prix). Un paiement à la boulangerie importé du relevé n'aura jamais de détail. Il faudra donc
   toujours montrer « dont **détaillé** : X € · **non détaillé** : Y € », et ne jamais faire comme si le
   détail couvrait tout.
2. **Les rayons ne sont pas des typologies.** Le rayon sert à se déplacer dans le magasin ; la
   typologie sert à comprendre la dépense. Dans tes deux courses : des allumettes fumées (des
   lardons) sont en « boucherie », des bières en « boissons », mais un **pèse-personne** et un
   **abattant WC** sont en « autre » — 39,89 € sur 82,72 €, presque la moitié, invisibles dans une
   lecture par rayon. Et « boissons » mêle l'eau (essentiel) et la bière (plaisir).

## 3. Proposition : deux niveaux, déduits des rayons, réglables par article

**Niveau 1 — la typologie**, une liste courte et fixe (comme les natures de Budget) :

| Typologie | Rayons qui y vont par défaut |
|---|---|
| 🥖 Alimentation | fruits et légumes, boulangerie, crèmerie, boucherie, épicerie salée et sucrée, surgelés, boissons |
| 🧴 Hygiène et beauté | hygiène |
| 🧽 Entretien | entretien |
| 🏠 Maison et équipement | — (le pèse-personne, l'abattant, une ampoule : deviné par mots-clés) |
| 👶 Bébé | bébé |
| 🐾 Animaux | animaux |
| 📦 Autre | autre |

**Niveau 2 — pour l'alimentation seulement**, ce que tu appelles « nécessaire / apéritif » :

| Sous-type | Exemples |
|---|---|
| Essentiel | pâtes, riz, légumes, viande, lait, beurre, pain, eau |
| Plaisir | apéritif (chips, cacahuètes, olives), sucreries, gâteaux, glaces, plats tout prêts « pour se faire plaisir » |
| Alcool | bière, vin, spiritueux |

Pourquoi trois et pas deux : l'alcool est souvent ce qu'on veut suivre à part, et il n'est ni
« nécessaire » ni tout à fait « apéritif ». Pourquoi pas plus : au-delà de trois ou quatre, on passe
son temps à hésiter, et la question « où part l'argent ? » n'en demande pas plus.

**Comment un article reçoit sa typologie** — le même chemin que le rayon aujourd'hui :

1. **Deviné** : d'abord d'après le rayon (tableau ci-dessus), puis par mots-clés pour ce que le
   rayon ne dit pas (« chips », « bière », « vin », « bonbons » → plaisir ou alcool ; « ampoule »,
   « abattant », « pèse-personne » → maison). Les mots-clés vivent dans une table testée, comme
   `AISLE_KEYWORDS`.
2. **Réglable une fois pour toutes** : l'article du catalogue (`courses_items`) garde sa typologie
   et son sous-type ; corriger « Kit de préparation » en « plaisir » vaut pour toutes ses prochaines
   courses.
3. **Figé dans la course**, comme le prix et le rayon : la ligne d'un ticket garde la typologie
   qu'elle avait ce jour-là (`courses_trip_items`), pour que l'historique ne bouge pas quand on
   reclasse un article. (Option : « appliquer aussi aux courses passées », proposé au moment de
   corriger.)
4. **Claude, à la lecture d'un ticket** (`courses_enregistrer_ticket`) : il propose déjà le rayon de
   chaque ligne ; il proposerait aussi la typologie — c'est exactement le raisonnement qu'il fait
   bien (« Allumettes fumées » = des lardons, pas des allumettes).

## 4. Où le voir

**Dans Budget**, là où on regarde déjà son mois — c'est le « mixte » demandé :

- Dans l'Aperçu, toucher la part « Courses » du camembert ouvre aujourd'hui le détail des
  sous-catégories (`SubcategoryDetail`). On y ajoute **« Le contenu de tes courses »** : une barre
  par typologie (Alimentation 27,48 €, Maison 39,89 €, Entretien 12,25 €, Hygiène 3,10 €), l'alimentation dépliable
  en essentiel / plaisir / alcool, et la ligne **« Non détaillé : 421,13 € »** (les opérations sans
  ticket), pour que le total reste juste.
- Dans **Évolution**, une courbe par typologie sur les mois, sur le même modèle que les autres :
  « le plaisir monte », « l'entretien est stable ».
- Toucher une opération « Courses — Auchan » dans la liste montrerait les lignes de son ticket
  (aujourd'hui, il faut aller dans Courses → Courses pour les voir).

**Dans Courses**, l'onglet Chiffres gagne la même répartition (pour qui regarde ses courses
plutôt que son budget), et le prix d'un article garde sa courbe.

**Comment Budget l'apprend sans importer Courses** : par un service, comme `expenses` et `shopping`
(`core/lib/services.ts`). Courses déclare `shoppingSpend` : « pour telle période, voici, par
référence d'opération (`comete:course:<n>`), les montants par typologie et sous-type ». Budget
rapproche par la référence qu'il a déjà, et sans Courses (service absent), rien ne change.

**Ce que je déconseille** : couper l'opération de Budget en plusieurs (une par typologie, dans des
sous-catégories de « Courses »). Ce serait plus simple à afficher — le camembert et les
sous-catégories le feraient tout seuls —, mais l'opération ne correspondrait plus au paiement de la
banque : le rapprochement qui évite les doublons à l'import compare des montants au centime
(`moduleMatch`), il ne reconnaîtrait plus la course, et elle compterait deux fois.

## 5. Les cas qui fâchent

- **Remises et total du ticket.** Si la somme des lignes ne fait pas le total payé (une remise en
  bas de ticket, un bon d'achat), l'écart est réparti sur les lignes au prorata — ou montré à part
  (« remises : −2,10 € »). Recommandé : à part, c'est ce qui s'est passé. Dans tes deux tickets,
  aucun écart.
- **Une course sans prix par ligne** (cochée en magasin, total tapé à la fin) : tout son montant va
  en « non détaillé », avec le rayon comme seul indice. On pourrait répartir selon les prix connus des
  articles (`estimate`), mais ce serait une estimation : à dire comme telle, ou ne pas faire.
  Recommandé : ne pas faire.
- **Plusieurs personnes** (« Remboursement courses Maelle ») : le remboursement baisse le total des
  courses dans Budget, pas une typologie. Il reste dans « non détaillé ».

## 6. Ce que ça demande, techniquement

- Une migration : `typology` et `subtype` sur `courses_items` (le défaut) et sur
  `courses_trip_items` (figés), avec leurs `CHECK` et leurs tableaux `as const` comparés par
  `schema.test.ts`.
- Des règles pures testées : `guessTypology(nom, rayon)`, la table des mots-clés, la répartition par
  période (`spendByTypology`), l'écart de ticket.
- Le service `shoppingSpend` (socle : la forme ; Courses : l'implémentation ; Budget : l'affichage).
- La reprise des lignes déjà enregistrées : une typologie devinée à la lecture pour celles qui n'en
  ont pas (sans rien écrire), puis écrite quand on corrige.
- Le connecteur : `courses_enregistrer_ticket` reçoit et propose la typologie de chaque ligne.

## 7. Découpage proposé

1. **Les règles** : typologies, sous-types, devinette, répartition — testées sur tes deux vrais
   tickets et un corpus de noms d'articles. Rien à l'écran.
2. **Le stockage** : migration, contrat de Courses et ses deux implémentations, reprise des lignes
   existantes, réglage par article dans Courses (fenêtre de l'article).
3. **Dans Budget** : le service, le détail de la part « Courses » (typologies, essentiel / plaisir /
   alcool, non détaillé), les lignes d'une opération.
4. **L'évolution** : par typologie dans Évolution, et l'onglet Chiffres de Courses.
5. **Claude** : la typologie lue sur le ticket.

La première vraie valeur arrive à l'étape 3.

## 8. Ce que ça ne fera pas

- Détailler une dépense **sans ticket** (relevé bancaire seul) : impossible sans deviner.
- Un budget par typologie avec alerte (« 50 € de plaisir par mois ») : possible ensuite, mais
  l'étude de Budget (§12) avait montré qu'un plafond avec voyant rouge change peu les dépenses ;
  la comparaison au mois d'avant, en teinte discrète, sert mieux.
- Des typologies libres, à inventer soi-même : plus souple, mais on finit avec « Apéro », « Apero »
  et « Apéritif ». Une liste fixe, réglable plus tard si elle ne suffit pas.

## 9. Questions pour Jules

1. **Les typologies** du §3 te conviennent-elles ? En ajouter (Vêtements ? Pharmacie ?) ou en
   retirer ?
2. **Le second niveau** : essentiel / plaisir / alcool, ou autre chose (« nécessaire / apéritif /
   sucré / alcool » ?) — et seulement pour l'alimentation, ou aussi ailleurs (hygiène : essentiel /
   cosmétique) ?
3. **Où le voir d'abord** : dans Budget (le détail de la part « Courses »), dans Courses (Chiffres),
   ou les deux dès l'étape 3 ?
4. **Les remises** : à part (« remises »), ou réparties sur les lignes ?
5. **Reclasser un article** : seulement pour les prochaines courses, ou proposer aussi de corriger
   les courses passées ?

## 10. Décisions et livraison (15/10/2026)

Réponses de Jules : **tout d'accord** (les typologies et essentiel / plaisir / alcool pour
l'alimentation), **visible dans les deux** (Budget et Courses), **remises à part**, et **reclasser
vaut aussi pour les courses passées**.

Cette dernière décision simplifie le modèle prévu au §3 : une ligne de course **ne fige plus** sa
typologie. Elle suit celle de son article du catalogue ; seule une ligne sans article (rare) porte
la sienne. Aucune fonction SQL de clôture n'a donc eu à changer.

Livré, les cinq étapes :

1. **Les règles** (`courses/lib/typology.ts`) : typologies, sous-types, `guessTypology` (mots-clés
   puis rayon), `classify`, `tripSpend` (remises à part, lignes sans prix « non détaillées »),
   `typologyRows`, `spendLinesOf` — testées sur les deux vrais tickets de Jules (alimentation
   27,48 € dont 1,82 € de plaisir et 5,25 € d'alcool ; maison 43,88 €).
2. **Le stockage** : migration `2026-10-15-courses-typologies.sql` (`typology`, `food_kind` sur
   `courses_items` et `courses_trip_items`, contraintes comparées au code), contrat
   (`classifyTripItem`) et ses deux implémentations, sauvegarde comprise ; « Dans les dépenses »
   dans la fenêtre d'un article (`TypologyPicker`).
3. **Dans Budget** : service du socle `shoppingSpend` (rendu par Courses,
   `courses/data/spendService.ts`) ; toucher une part du camembert qui contient des courses
   détaillées montre « Le contenu de tes courses » (`ShoppingContent`) — typologies, essentiel /
   plaisir / alcool, remises, lignes sans prix, et ce qui reste **sans ticket** ; chaque course s'y
   déplie sur ses lignes, **reclassables d'un geste** (l'article suit, ses courses passées aussi).
4. **L'évolution** : une quatrième section dans Évolution de Budget (une typologie ou un sous-type,
   mois par mois), et « Par typologie » dans les Chiffres de Courses (ce mois-ci, 12 mois, tout).
5. **Claude** : `courses_enregistrer_ticket` reçoit la typologie de chaque ligne et l'applique à
   l'article ; `courses_article_modifier` la change ; le catalogue la montre. Un échec de
   classement (migration pas encore appliquée) n'annule jamais le ticket.
