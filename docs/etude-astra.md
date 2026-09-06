# Astra — étude du module budget

*Étude de conception, écrite avant le code. Le « pourquoi un module plutôt qu'une app ou un
tableur » est dans `docs/etude-budget-solutions.md` ; ce document décrit **ce qu'on construit**.*

---

## 1. Le périmètre, tranché

| Question | Réponse retenue |
|---|---|
| Objectif de la V1 | **Constater**, pas piloter. Aucune enveloppe, aucun budget prévu |
| Alimentation | **Import du relevé CSV** chaque mois, **plus la saisie ponctuelle** (espèces, dépense partagée) |
| Comptes bancaires | **Un seul**. Pas de notion de compte dans le modèle |
| Utilisateurs | **Chacun le sien**, isolé par le Row Level Security, comme Zénith |
| Vue V1 | **La répartition du mois**, en camembert |

**Pourquoi constater d'abord.** Fixer des enveloppes le jour de l'emménagement, c'est inventer
des chiffres : personne ne sait ce que coûtent ses courses dans un logement où il n'a pas
encore vécu. Trois mois de relevés donneront les montants réels. Les enveloppes viendront
ensuite, et elles seront justes.

**Ce que la V1 ne fait pas, et qui viendra :** la comparaison mois par mois — celle qui montre
où économiser — les enveloppes par catégorie, et la courbe du reste-à-vivre. Le modèle de
données ci-dessous les rend possibles **sans migration** : ce ne sont que des lectures
différentes des mêmes lignes.

---

## 2. Le modèle de données

Trois tables. Toutes préfixées `budget_`, toutes avec `user_id`, toutes avec leurs quatre
politiques RLS — la convention de `CLAUDE.md`.

### `budget_categories`

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | |
| `name` | text | « Courses », « Loyer »… librement défini |
| `emoji` | text | Pour lire le camembert d'un coup d'œil |
| `color` | text | Couleur de la part |
| `kind` | text | `fixe` · `variable` · `revenu` · `transfert` |
| `position` | integer | Ordre d'affichage |

**`kind` n'est pas décoratif.** Il porte trois décisions :

- `fixe` sépare ce qui tombe tous les mois de ce sur quoi on peut agir. C'est lui qui rendra
  possible le reste-à-vivre plus tard, sans rien changer aux données déjà saisies.
- `transfert` **exclut la ligne du camembert**. Un virement vers ton livret n'est pas une
  dépense ; sans cette catégorie, épargner ressemblerait à dépenser, et le mois où tu mets
  300 € de côté serait ton pire mois. C'est le piège le plus classique de ce genre d'outil.
- `revenu` distingue le salaire des dépenses, évidemment.

Suivant la convention : cette liste vit aussi en TypeScript en tableau `as const`, avec un test
qui la compare au `CHECK` de la base. La divergence s'est déjà produite sur `TIER_KINDS`.

### `budget_entries`

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid | |
| `user_id` | uuid | |
| `day` | date | Jour de l'opération |
| `label` | text | Libellé, tel que la banque l'écrit |
| `amount_cents` | integer | **Signé** : négatif = sortie, positif = entrée |
| `category_id` | uuid **nullable** | Null = pas encore catégorisé |
| `source` | text | `import` · `manuelle` |
| `import_key` | text nullable | Empreinte de dédoublonnage (voir §4) |
| `note` | text | Libre |

**Montants en centimes entiers, jamais en flottant.** `0,1 + 0,2` ne fait pas `0,3` en
virgule flottante ; un total de budget qui tombe à un centime près donne l'impression d'un
outil cassé, et c'est le genre de défaut qu'on ne peut plus corriger une fois les données
saisies.

**`category_id` est nullable, et c'est délibéré.** Une opération non catégorisée doit
apparaître dans le camembert sous une part « À classer », visible et cliquable. Si on la
masquait, le total afficherait moins que ce qui a réellement quitté le compte — et tu
croirais l'outil menteur.

**Pas de colonne `month`.** Le mois se déduit de `day`. Une colonne dérivée est une occasion
de divergence, pour zéro gain à cette échelle. Index sur `(user_id, day)`.

### `budget_rules`

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `user_id` | | |
| `pattern` | text | Fragment cherché dans le libellé, insensible à la casse |
| `category_id` | uuid | La catégorie à appliquer |
| `priority` | integer | La plus haute gagne en cas de recouvrement |

C'est ce qui fait que l'import devient de moins en moins coûteux : le deuxième mois, l'essentiel
se range tout seul.

---

## 3. Les catégories de départ

Un premier appartement seul, en France. Proposées à la création du compte, toutes renommables
et supprimables — ce ne sont que des valeurs de départ, pas un cadre.

**Fixes :** Loyer · Charges & copropriété · Électricité / gaz · Internet & mobile · Assurances
(habitation, santé) · Abonnements · Transport (forfait)

**Variables :** Courses · Restaurants & bars · Sorties & loisirs · Vêtements · Santé ·
Maison & équipement · Cadeaux · Voyages · Divers

**Revenus :** Salaire · Aides (APL) · Remboursements

**Transferts :** Épargne · Virements internes

Une quinzaine de catégories, c'est le bon ordre de grandeur : moins, et le camembert
n'apprend rien ; beaucoup plus, et chaque import devient un travail de tri.

---

## 4. L'import du relevé

### La règle d'or : réimporter ne doit jamais dupliquer

C'est le cœur du problème, et la source de la seule vraie complexité du module.

Chaque ligne importée reçoit une **empreinte** calculée sur `jour + libellé + montant`, plus
un **rang d'occurrence** dans le fichier. Le rang est indispensable : deux cafés à 2,50 € le
même jour au même endroit sont deux lignes légitimes, pas un doublon. Sans lui, le second
disparaîtrait silencieusement.

L'empreinte est stockée dans `import_key`, avec une contrainte d'unicité
`(user_id, import_key)`. Réimporter le même mois ne fait alors rien : c'est ce qui permet de
réimporter sans crainte quand on ne se souvient plus si on l'a déjà fait — et on ne s'en
souvient jamais.

### Le déroulé

1. Tu déposes le CSV exporté depuis ton espace BoursoBank.
2. Astra lit les lignes, applique les règles de catégorisation, et **montre un aperçu** :
   tant de nouvelles opérations, tant déjà connues, tant à classer.
3. Tu valides. Rien n'est écrit avant.
4. Les lignes à classer apparaissent en tête de liste, à ranger d'un geste. Ranger une ligne
   propose de créer la règle correspondante.

### Ce qu'il faut avant d'écrire l'importeur

**Un vrai export BoursoBank.** Le séparateur, l'encodage, le format de date, le format des
montants, la présence ou non d'un en-tête : tout cela se devine mal et se vérifie en trente
secondes sur un fichier réel. Exporte un mois et joins-le à la conversation qui construira
l'import — c'est le premier geste de ce chantier.

---

## 5. Les écrans de la V1

**L'écran du mois.** Le total dépensé, le camembert par catégorie, et le sélecteur de mois.
Cliquer une part filtre la liste en dessous.

**La liste des opérations, sous le camembert.** Tu n'as coché que le camembert, et je l'ai
suivi pour les *vues d'analyse* — pas de comparaison mensuelle, pas de courbe en V1. Mais la
liste n'est pas une vue d'analyse, c'est **l'outil de correction** : sans elle, impossible de
rattraper une ligne mal rangée, et un camembert qu'on ne peut pas corriger devient faux au
bout de deux mois. Elle reste donc au programme.

**L'écran d'import.** Dépôt du fichier, aperçu, validation.

**L'ajout manuel.** Un formulaire court — jour, libellé, montant, catégorie — accessible en un
geste depuis l'écran du mois.

**Les catégories.** Créer, renommer, changer la couleur, l'emoji et le `kind`.

---

## 6. Les pièges à ne pas se prendre

**Les virements internes.** Traités par `kind = transfert`, exclus du camembert. Sans ça, mettre
de l'argent de côté compte comme une dépense.

**Les remboursements.** Un ami te rend 40 € sur un restaurant : c'est une entrée positive **dans
la catégorie Restaurants**, pas un revenu. Le montant signé le permet naturellement — la
catégorie totalise alors 40 € de moins. C'est la raison d'être du signe plutôt que d'un champ
`type`.

**Le mois à cheval.** Une dépense du 31 payée le 2 apparaît en date de valeur au mois suivant.
On garde la date du relevé, sans chercher à corriger : la cohérence avec ton relevé bancaire
vaut mieux qu'une exactitude théorique que tu ne pourras jamais recouper.

**Le premier mois d'emménagement sera aberrant.** Caution, meubles, dépôt de garantie, frais
d'agence : il ne ressemblera à aucun autre. Ne rien en conclure, et ne surtout pas en tirer
des enveloppes.

---

## 7. Découpage du chantier

| # | Étape | Ce qu'elle livre |
|---|---|---|
| 1 | Migration SQL + contrat de stockage + deux implémentations | Le module existe, vide, et passe `conventions.test.ts` |
| 2 | Catégories : création, édition, valeurs de départ | On peut ranger |
| 3 | Saisie manuelle + liste des opérations | Le module devient utilisable seul |
| 4 | Camembert du mois | La V1 est atteinte |
| 5 | Import CSV + règles | L'usage devient tenable dans la durée |

Les étapes 1 à 4 ne dépendent pas du format du relevé : elles peuvent être construites avant
que tu aies exporté quoi que ce soit. Seule l'étape 5 attend ton fichier.

**Chaque étape est un commit, avec `npm run test` et `npm run check` au vert.**

---

## 8. Deux améliorations UX, post-V1 (31/08/2026)

Étudiées avant d'être codées, à la demande de Jules — deux frottements remontés une fois la V1
en usage réel.

**Le bouton d'ajout était hors d'atteinte.** `+ Nouvelle écriture` et `+ Nouvelle catégorie`
vivaient après la liste qu'ils complètent ; avec un mois chargé ou la vingtaine de catégories
de départ, il fallait scroller jusqu'au bout pour les atteindre. Trois options envisagées :
le déplacer avant la liste (comme le fait déjà « + Objectif » de Zénith dans sa barre du haut),
le dupliquer aux deux endroits, ou le rendre `position: sticky`. Retenu : **sticky**, ancré en
bas du viewport — la seule des trois options qui reste vraie même en scrollant, alors que même
le bouton de Zénith défile dès qu'on dépasse sa position d'origine (aucun `position: sticky`
n'existait nulle part dans le socle avant ce jour). Changement purement CSS, aucun déplacement
dans le DOM.

**Trouver la bonne catégorie était pénible.** Un `<select>` listant toutes les catégories à
plat, sans groupe ni raccourci. Trois pistes combinées :

- **Le menu groupé par nature** (`<optgroup>`), sur le même découpage que l'écran Catégories —
  `CATEGORY_KIND_LABELS` factorisé dans `lib/types.ts` pour que les deux écrans ne puissent
  pas diverger.
- **Une suggestion par mots-clés**, en réutilisant tel quel le moteur déjà écrit pour l'import
  (`matchRule`, `boursobankImport.ts` — un libellé est un libellé, rien de spécifique à
  l'import). Elle ne s'applique qu'à une **nouvelle** écriture, et seulement tant que
  l'utilisateur n'a pas lui-même choisi une catégorie : ni une écriture en cours de
  modification (elle a déjà la sienne), ni une catégorie déjà cliquée en pastille, ne doivent
  jamais se voir réécrites en silence pendant qu'on corrige le libellé.
- **Des catégories fréquentes en pastilles**, calculées sur l'historique complet des écritures
  (`mostUsedCategoryIds`), pas seulement le mois affiché — sans quoi la catégorie qu'on utilise
  chaque mois disparaîtrait le premier jour d'un nouveau mois. Volontairement pas filtrées par
  dépense/entrée : un remboursement pointe légitimement vers une catégorie de dépense, filtrer
  aurait caché ce cas plutôt que de le servir.

**Ce qui n'a pas été retenu** : un vrai système de favoris géré à la main (cocher une
catégorie comme favorite). Le calcul automatique par fréquence donne le même bénéfice sans
réglage à tenir à jour.

### Le sticky en pastille ne convainquait pas (31/08/2026)

Premier retour de Jules après coup : « le système est cool, mais l'UI n'est pas top ». Le
bouton sticky, laissé à sa taille et son alignement à gauche d'origine, flottait comme une
pastille un peu perdue au-dessus de la liste — pas assez affirmé pour se lire comme une vraie
action. Retravaillé en **barre pleine largeur** (`align-self: stretch`, texte centré, padding
plus généreux) : une vraie barre d'action ancrée en bas, alignée avec la largeur de la liste
au-dessus, plus facile à viser au pouce sur téléphone.

**Vérification mobile demandée dans la foulée** — jamais faite pour Astra non plus,
contrairement à ce que le journal laissait penser (des correctifs mobiles existent depuis le
23-24/08/2026, mais aucune vérification e2e n'avait suivi). Un vrai bug trouvé : les lignes de
catégorie (`BudgetScreen.tsx`, classe `.budget-row` nue) n'avaient jamais reçu le traitement de
repli déjà appliqué aux lignes d'écriture (`.budget-entry-row`) et d'enveloppe
(`.budget-envelope-row`) sous 520px — un nom de catégorie un peu long plus les deux boutons
d'action dépassaient l'écran. Corrigé en leur donnant leur propre classe
(`.budget-category-row`) et le même repli en dessous de 520px. Les quatre onglets (Aperçu,
Épargne, Importer, Catégories) et l'éditeur d'écriture ont été vérifiés sans débordement sur un
viewport de 390 px.

### De la barre pleine largeur au bouton flottant (31/08/2026, même jour)

Deuxième retour de Jules, quelques minutes plus tard : « le bouton est beaucoup trop gros et
visible ». La barre pleine largeur corrigeait le problème initial (l'atteindre sans scroller)
mais en créait un autre — elle dominait l'écran. Étudié avant de retoucher : le motif standard
pour ce geste précis (ajouter un élément à une liste, toujours accessible, jamais envahissant)
est le **FAB** (floating action button) de Material Design — un petit bouton rond, icône seule,
ancré dans un coin, popularisé par Gmail, Google Keep, Trello mobile.

**Adopté tel quel** : `.budget-add` redevient minuscule (46 px), rond, avec pour seul contenu
un « + » — `align-self: flex-end` le pousse dans le coin bas-droit de la liste plutôt qu'à
gauche ou étiré sur toute la largeur. Le nom accessible (« Nouvelle écriture », « Nouvelle
catégorie ») ne disparaît pas pour autant : il vit dans `aria-label`/`title` sur le `<button>`
lui-même, exactement le motif déjà utilisé pour les boutons icône-seule de la barre du haut
d'Orbite (`docs/etude-flashcards.md` §16) — un bouton dont tout le contenu visible serait
`aria-hidden` n'aurait sinon plus de nom du tout.

**Troisième retour, immédiat** : le « + » n'était pas centré verticalement dans le rond. Mesuré
avant de corriger, plutôt que de deviner : la boîte flex qui contient l'icône est parfaitement
centrée (0 px d'écart entre son centre et celui du bouton), mais le glyphe « + » de la police
ne l'est pas dans sa propre boîte de texte — un défaut de métriques de police, pas de mise en
page. Corrigé en dessinant le « + » en CSS pur (deux barres positionnées indépendamment via
`::before`/`::after`, `.budget-add-icon`) plutôt qu'en ajoutant un décalage approximatif qui
n'aurait tenu que par hasard sur une police et un navigateur donnés.

## 9. Sous-catégories, un seul niveau (06/09/2026)

Demande de Jules, avec deux exemples : « Divertissement / Loisir » puis « cartes One Piece »,
ou « Restaurants / bars » puis « Restaurants », « Bar » en dessous — et la question ouverte
« plusieurs catégories, ou catégories puis sous-catégories ? ». Étudié avant de coder.

**Sous-catégories, pas multi-tag.** Les deux exemples sont strictement hiérarchiques : un achat
de cartes One Piece **est** une dépense de loisir, il n'est jamais *en plus* autre chose. Le
multi-tag (une écriture rattachée à plusieurs catégories indépendantes) poserait un problème que
le modèle actuel n'a pas : `computeMonthlyBreakdown` agrège chaque écriture dans **une seule**
catégorie, et un montant compté dans deux tags à la fois ferait mentir le total du mois — pour
l'éviter il faudrait de toute façon désigner une catégorie « principale », ce qui réinvente une
hiérarchie par un autre chemin. Tranché avec Jules : sous-catégories.

**Un seul niveau de profondeur.** Une sous-catégorie ne peut jamais elle-même être parente —
`isValidParent`/`hasChildren` (`lib/categoryHierarchy.ts`) le vérifient à la création et à
l'édition, dans les deux implémentations. Collé aux deux exemples de Jules, ça évite un
`<select>` à trois niveaux (un `<optgroup>` HTML ne s'imbrique pas — un deuxième niveau
d'indentation, via un préfixe « ↳ », est déjà une concession visuelle ; un troisième serait
illisible) et un camembert à quatre étages pour la même raison.

**`kind` hérité, jamais un choix libre.** Une sous-catégorie de « Restaurants & bars »
(`variable`) est forcément `variable` elle aussi — `CategoryEditor` n'affiche même pas le
sélecteur de nature pour une sous-catégorie, juste un rappel (« Variable — comme
« Restaurants & bars » »). Stocké quand même sur chaque ligne (pas recalculé par une remontée
vers le parent) : voir le point suivant.

**Supprimer un parent promeut ses sous-catégories, ne les efface jamais.** Même philosophie que
« à classer » pour une écriture qui perd sa catégorie (§2 ci-dessus), un niveau plus haut :
`deleteCategory` détache les enfants (`parent_id = null` côté Supabase, via `on delete set
null` — jamais `cascade`) plutôt que de les supprimer avec leur parent. C'est précisément pour
que la sous-catégorie promue reste utilisable seule que son `kind` est stocké en dur plutôt que
recalculé : une catégorie qui vient de perdre son parent n'a alors aucune information à perdre.
Changer la nature d'un parent existant cascade sur ses enfants pour la même raison, dans l'autre
sens (`updateCategory`, les deux implémentations).

### Le camembert : rollup, avec un détail à part (maquettes comparées)

Question restée ouverte après la première réponse de Jules (« regroupé dans le parent, MAIS
avoir une possibilité de voir le détail — encore à définir comment ») : trois maquettes
publiées en artifact, recréant le vrai thème sombre d'Astra, comparant une petite liste sous le
camembert, un camembert qui se transforme en drill-down, et un second camembert permanent à
côté. Choix de Jules : **la petite liste**.

- **Le camembert n'affiche jamais qu'une seule part par catégorie parente** —
  `rollupKey` (`lib/monthlyBreakdown.ts`) fait remonter le montant d'une sous-catégorie dans la
  part de son parent avant l'agrégation. Sans ça, une sous-catégorie créée pour chaque nouvel
  achat un peu particulier ferait exploser le nombre de parts — exactement le risque que §3 met
  en garde contre (« une quinzaine de catégories, c'est le bon ordre de grandeur »).
- **Cliquer la part d'un parent** filtre la liste des écritures sur lui ET toutes ses
  sous-catégories (`MonthScreen.tsx`), et affiche en plus, juste au-dessus,
  `SubcategoryDetail` : le détail par sous-catégorie, une barre par ligne. Une écriture posée
  directement sur le parent (sans sous-catégorie précisée) y devient « Non précisé » — jamais
  masquée, même garantie que « À classer » au niveau du camembert — avec la couleur du parent,
  pas le gris neutre de l'incatégorisé : elle reste une écriture de Loisirs, juste pas détaillée
  plus loin.
- `subcategoryBreakdown` reprend la même construction à deux temps (dépenses/entrées) que
  `computeMonthlyBreakdown`, pour la même raison : un remboursement dans une sous-catégorie doit
  pouvoir réduire sa part sans devenir un revenu.

### Créer une sous-catégorie, et la retrouver à la saisie

`CategoryEditor` ne demande jamais où vivra une sous-catégorie : le bouton « + Sous-catégorie »
vit sur la ligne de son futur parent, dans `BudgetScreen.tsx` — le contexte suffit, aucun
sélecteur de parent à remplir à la main. `EntryEditor` l'affiche juste après la sienne, dans le
même `<optgroup>` de nature, en retrait (« ↳ Cartes One Piece ») ; le parent reste
sélectionnable tel quel (choix de Jules) pour une dépense qu'on ne veut pas détailler à chaque
fois.

**Piège trouvé en vérifiant** : une catégorie enregistrée avant cette fonctionnalité n'a pas de
champ `parentId` du tout (`undefined`, pas `null`) — `LocalBudget.read()` le normalise
maintenant à la lecture (`c.parentId ?? null`), sans quoi toute catégorie plus ancienne que ce
chantier aurait disparu des groupes (ni « normale » ni « sous-catégorie », invisible des deux
filtres). Repéré par les six vérifications post-V1 existantes, cassées net avant ce correctif —
la preuve que la suite e2e couvre aussi la compatibilité arrière, pas seulement les cas neufs.

Migration `2026-09-06-budget-subcategories.sql` : une seule colonne nullable
(`budget_categories.parent_id`), aucune contrainte `CHECK` nouvelle — la profondeur à un niveau
est un invariant applicatif, vérifié aux deux implémentations et testé (`categoryHierarchy.test.ts`),
pas une contrainte SQL. `526/526` tests unitaires → (+19), `421/421` local → `427/427` (+14 :
rollup du camembert, détail par sous-catégorie, gestion depuis l'écran Catégories, promotion à
la suppression du parent), `433/433` en mode comptes → `439/439` (+14).

## 10. Raccourci clavier « N » — nouvelle écriture (06/09/2026)

Demande de Jules. Posé dans `EntriesView.tsx`, qui possède déjà l'état `editing` et le bouton
flottant « + » : le raccourci n'existe donc que sur l'onglet Aperçu, là où « nouvelle écriture »
a un sens — pas de plomberie à ajouter ailleurs. Trois garde-fous, alors qu'aucun raccourci
lettre seule n'existait encore nulle part dans Atlas (seul `Escape` ferme déjà une fenêtre,
partout, sans jamais vérifier où est le focus) :

- **jamais pendant la frappe** — ignoré si le focus est sur un `<input>`, `<textarea>`,
  `<select>` ou un élément éditable, sans quoi taper un mot contenant un « n » ré-ouvrirait
  l'éditeur par-dessus lui-même ;
- **jamais par-dessus un éditeur déjà ouvert** (`editing !== null`) ;
- **jamais avec un modificateur** — Cmd/Ctrl+N reste la nouvelle fenêtre du navigateur.

Le raccourci est annoncé dans le titre du bouton flottant (« Nouvelle écriture (N) ») plutôt que
caché : un raccourci qu'on ne découvre jamais ne sert à personne. `427/427` local → `432/432`
(+5 : ouverture au clavier, non-interférence en tapant un « n », fermeture, écriture réellement
enregistrée), `439/439` en mode comptes → `444/444` (+5).

## 11. Le bouton flottant d'une enveloppe affichait encore son ancien texte (06/09/2026)

Rapporté par Jules : « on voit "nouvelle..." qqchose écrit sur le bouton » sur l'onglet Épargne.
Le bouton « + Nouvelle enveloppe » (`EnvelopesScreen.tsx`) n'avait jamais reçu la migration vers
le bouton flottant icône-seule faite pour les catégories et les écritures (§8, « De la barre
pleine largeur au bouton flottant ») : il gardait son texte d'origine tout en héritant la classe
`.budget-add` (rond, 46 px) — le texte débordait du rond au lieu de disparaître derrière
`aria-label`. Jamais couvert par les vérifications de bout en bout : la suite ne crée qu'une
seule enveloppe (« Voiture »), toujours via le bouton de l'écran vide, jamais via ce bouton
flottant. Corrigé à l'identique du motif déjà en place ailleurs (icône seule, nom accessible en
`title`/`aria-label`), et une vérification ajoutée pour ne plus jamais perdre ce cas de vue.
`432/432` local → `434/434` (+2), `444/444` en mode comptes → `446/446` (+2).
