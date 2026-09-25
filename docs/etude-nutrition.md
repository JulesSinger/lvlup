# Nutrition — étude du quatrième module (calories et macronutriments)

*Étude de conception, écrite avant le code — même exercice que `docs/etude-astra.md` et
`docs/etude-flashcards.md`. Objectif : savoir ce que fait le marché, ce qu'Atlas permet
réellement de construire sous sa contrainte « gratuit à vie », et ce qui va bloquer, avant
d'écrire une ligne. Les décisions qui reviennent à Jules sont regroupées en fin de document
(§11).*

Demande de Jules (25/09/2026) : « entrer mes calories, mes aliments, savoir combien j'ai
ingéré de calories dans une journée et combien sur certaines catégories — lipides, glucides,
protéines —, me fixer un objectif par journée, et comprendre à quoi ça sert ».

---

## 1. Ce qui existe déjà, et sur quoi ce module s'appuie

Comme Astra et Orbite, le module hérite **gratuitement** du socle : comptes, Row Level
Security, synchronisation entre appareils, panneau de réglages (`AtlasModule.SettingsSection`),
sauvegarde versionnée par module, hébergement. Il suit la mécanique d'ajout de `CLAUDE.md` §3 :
un dossier, un contrat de stockage et ses deux implémentations, une ligne au registre, une
migration datée.

**Vérifié dans le code, pas supposé :**

- `index.html` ne déclare **aucune Content Security Policy** : un appel à une API externe
  depuis le navigateur n'est bloqué par rien.
- `public/sw.js` (ligne 30) **ignore toute requête vers un autre domaine** : le service
  worker ne mettra pas en cache, ni ne cassera, un appel à Open Food Facts (§4).
- Les rappels push existent (`core/lib/push.ts`, `supabase/functions/send-reminders/`), mais
  leur texte est encore écrit pour Zénith (« Ta série de N jours t'attend »). Un rappel
  « pense à noter ton déjeuner » demanderait de rendre ce texte générique — **pas nécessaire en
  V1**, même conclusion qu'Orbite.

**Ce qui ne se réutilise pas** (`conventions.test.ts` interdit tout import entre modules) :
`dayString`/`shiftDay` (à recopier, comme Orbite l'a fait dans `flashcards/lib/day.ts`), les
graphes de Zénith et d'Astra, la barre de progression d'un palier.

**Ce qui est neuf dans le projet :** un **référentiel volumineux et statique** (plusieurs
milliers d'aliments, §4) livré avec l'application. Aucun module n'embarque aujourd'hui autre
chose que du code et une poignée de catégories de départ.

**Ce qui arrive enfin à échéance :** la file hors ligne. `CLAUDE.md` §6 prévient qu'elle est
écrite pour Zénith seul et qu'il faudra la généraliser dans `core/` « le jour où un autre
module devra écrire en mobilité ». Noter son déjeuner au restaurant, au sous-sol, avec une
barre de réseau, **c'est exactement ce jour-là** — voir §8.

---

## 2. Les macronutriments : à quoi ça sert

Cette section répond à la partie « à quoi ça sert » de la demande, et servira de base au texte
d'aide affiché dans le module.

### L'énergie

Trois familles d'aliments apportent l'énergie, avec un rendement fixe par gramme :

| Macronutriment | kcal par gramme |
|---|---|
| Protéines | 4 |
| Glucides | 4 |
| Lipides | **9** |
| *(Alcool — pas un nutriment, mais une énergie bien réelle)* | *7* |

C'est ce qui relie les grammes et les pourcentages : sur 2 200 kcal, 25 % de protéines
représentent 550 kcal, soit **137 g** (550 ÷ 4). Le même calcul pour les lipides divise par 9 —
d'où l'impression trompeuse qu'un aliment gras « pèse peu » en grammes alors qu'il pèse lourd
en calories.

### Le rôle de chacun

- **Protéines** — la matière de construction : muscles, enzymes, peau, défenses immunitaires.
  Ce sont les plus rassasiantes des trois. On les raisonne souvent en **grammes par kilo de
  poids** plutôt qu'en pourcentage : la référence française pour un adulte est d'environ
  0,83 g/kg/jour ; les recommandations sportives courantes montent à 1,6–2,2 g/kg pour
  construire ou garder du muscle.
- **Glucides** — le carburant rapide, et celui du cerveau. Ils comprennent les sucres (dont on
  cherche à limiter les sucres ajoutés) et l'amidon (pain, riz, pâtes, légumineuses).
- **Lipides** — indispensables malgré leur réputation : ils portent les vitamines A, D, E et K,
  fabriquent certaines hormones, et apportent des acides gras que le corps ne sait pas produire
  (oméga-3 et oméga-6).
- **Fibres** — comptées parmi les glucides sur les étiquettes, peu énergétiques, mais utiles à
  la digestion et à la satiété. Repère : environ 30 g par jour.

### Les repères officiels

L'ANSES (repères de 2016 pour l'adulte) exprime les apports en **part de l'énergie totale** :

| | Part de l'énergie |
|---|---|
| Protéines | 10 à 20 % |
| Lipides | 35 à 40 % |
| Glucides | 40 à 55 % |

Ce sont des fourchettes pour la population générale, pas des consignes individuelles : un
objectif sportif (prise de muscle, sèche) les décale souvent vers plus de protéines. Le module
**proposera** ces fourchettes comme point de départ, sans jamais les imposer.

### Le « combien »

La dépense quotidienne s'estime en deux temps : le **métabolisme de base** (formule de
Mifflin-St Jeor, à partir du poids, de la taille, de l'âge et du sexe), multiplié par un
**facteur d'activité** (environ 1,2 pour une vie sédentaire, jusqu'à 1,9 pour un travail
physique plus du sport). On retranche ou on ajoute ensuite selon le but (perdre, maintenir,
prendre). **C'est une estimation à ±10–15 %** : elle sert à poser un premier chiffre, que
l'utilisateur corrige ensuite à la main.

---

## 3. Le marché

| Application | Point fort | Modèle économique (2026) | Ce qu'on en retient |
|---|---|---|---|
| **MyFitnessPal** | la plus grosse base d'aliments | scan de code-barres **payant** depuis 2024 (~80 $/an) | base participative : énormément de doublons et d'erreurs. La quantité ne remplace pas la fiabilité |
| **Yazio** | bonne couverture des produits français, joli | offre gratuite avec scan ; Pro ~48 €/an | la saisie par repas (petit-déjeuner, déjeuner, dîner, collation) est le standard |
| **Cronometer** | données **vérifiées** (bases officielles), 80+ nutriments | offre gratuite ; Gold ~60 $/an | une base officielle vaut mieux qu'une base géante — c'est le choix fait ici avec CIQUAL (§4) |
| **MacroFactor** | objectif **adaptatif** : recalcule la vraie dépense à partir du poids et de ce qui a été mangé | aucune offre gratuite, ~72 $/an | l'idée la plus intéressante du marché, et purement mathématique — faisable un jour sans rien payer (§5, hors V1) |
| **Foodvisor** (FR) | reconnaissance de l'assiette **par photo** | payant, ~10 $/mois | exclu pour de bon : demande un modèle de vision payant à chaque photo (§8) |
| **Lose It!**, **FatSecret** | simples, gratuits | offre gratuite large | — |

**La leçon commune à tous :** ce qui fait abandonner une app de nutrition, ce n'est ni le
manque de graphiques ni la précision au gramme, c'est **la friction de la saisie**. Noter cinq
repas par jour, tous les jours, ne tient que si chaque saisie prend quelques secondes. Ce qui
marche partout :

1. les **aliments récents et favoris** en tête de la recherche (on mange souvent la même chose) ;
2. **copier un repas** d'un autre jour (le petit-déjeuner d'hier) ;
3. le **scan du code-barres** pour les produits emballés ;
4. les **recettes** (un plat maison saisi une fois, réutilisé ensuite).

Le périmètre de la V1 (§5) est construit autour des deux premiers : ils ne coûtent rien et
suppriment la plus grosse part de la friction.

---

## 4. Les sources de données — la vraie question de ce module

Un module de nutrition vaut ce que vaut sa base d'aliments. Personne ne saisira à la main les
valeurs de chaque yaourt. Deux sources gratuites existent, complémentaires.

### CIQUAL (ANSES) — les aliments génériques, embarqués dans l'app

- **3 484 aliments** dans la version 2025 (« pomme crue », « riz basmati cuit », « poulet,
  filet, rôti »), en français, valeurs pour 100 g, macros et fibres comprises.
- Publiée en **Licence Ouverte** : réutilisation libre, à condition de **citer la source**
  (« Table Ciqual 2025, ANSES »).
- Téléchargeable en Excel ou XML.

**Proposition : ne pas la mettre en base, l'embarquer dans l'application.** Un script
(`scripts/`, lancé une fois par nouvelle version de la table) réduit le fichier officiel à ce
dont le module a besoin — code, nom, kcal, protéines, glucides, lipides, fibres — et produit un
JSON chargé **à la demande**, seulement quand on ouvre le module. Conséquences :

- recherche **instantanée**, pendant la frappe, sans aucun appel réseau ;
- fonctionne **hors ligne** ;
- **zéro** ligne dans Supabase (le palier gratuit n'est pas entamé), zéro limite d'appels ;
- une entrée de journal référence l'aliment par son **code CIQUAL**, stable d'une version à
  l'autre de la table.

Coût à mesurer au build : quelques centaines de ko avant compression. À isoler dans son propre
fichier (import dynamique) pour que le reste d'Atlas n'en porte jamais le poids.

### Open Food Facts — les produits de marque, par code-barres

- Plusieurs millions de produits emballés, avec l'étiquette nutritionnelle.
- Licence **ODbL** : attribution obligatoire. Données **participatives et sans garantie** —
  des erreurs existent.
- API gratuite, sans clé pour la lecture. **Vérifié le 25/09/2026** : elle répond depuis un
  navigateur (`access-control-allow-origin: *`), et accepte l'en-tête `X-User-Agent` —
  important, car un navigateur interdit de modifier `User-Agent`, qu'OFF demande pour
  identifier l'application.
- **Limites strictes** : 15 lectures de produit par minute, **10 recherches par minute**, et la
  documentation interdit explicitement la recherche pendant la frappe (« you would be blocked
  very quickly »).

**Conséquence directe : OFF sert au code-barres, et à rien d'autre.** Une lecture par scan est
très loin de la limite. La recherche textuelle passe par CIQUAL et les aliments personnels, qui
sont locaux. Chaque produit scanné est **recopié dans les aliments de l'utilisateur**
(`nutrition_foods`, §6) : le rescanner la semaine suivante ne coûte plus aucun appel, marche
hors ligne, et l'utilisateur peut corriger une valeur fausse dans sa propre copie.

### Les aliments personnels

Tout ce que ni CIQUAL ni OFF ne connaissent — le plat de la cantine, une recette de famille,
un produit mal renseigné : saisis une fois depuis l'étiquette ou estimés, puis retrouvés dans
la recherche comme n'importe quel autre aliment.

**Mentions de licence :** une ligne discrète dans le module (« Données : Ciqual 2025 ANSES,
Open Food Facts ») suffit aux deux licences.

---

## 5. Le périmètre proposé pour la V1

| Question | Réponse proposée |
|---|---|
| Écran principal | **Le journal du jour**, découpé en repas (petit-déjeuner, déjeuner, dîner, collation), avec le total du jour en haut |
| Ajouter un aliment | Recherche dans CIQUAL + aliments perso, **récents et favoris en tête**, quantité en grammes (avec portions : « 1 pomme ≈ 150 g » quand l'aliment en connaît une) |
| Totaux | kcal, protéines, glucides, lipides — chacun en barre face à l'objectif |
| Objectif | kcal par jour + répartition des macros, **en % ou en grammes** (§11) ; un calculateur propose un chiffre de départ (§2), toujours modifiable |
| Changer de jour | Flèches jour précédent/suivant, comme le mois d'Astra |
| Copier un repas | Oui dès la V1 (« même petit-déjeuner qu'hier ») — le meilleur rapport gain/effort de tout le marché |
| Aliments perso | Oui dès la V1, sans eux un plat de cantine est impossible à noter |
| Scan de code-barres | **Hors V1** (§8, question §11) ; la saisie du code chiffré peut arriver avant la caméra |
| Recettes | Hors V1 |
| Suivi du poids, objectif adaptatif | Hors V1 — pur calcul, gratuit, une belle étape suivante |
| Micronutriments (vitamines, sel…) | Hors V1 ; CIQUAL les contient, les ajouter plus tard ne demande qu'une colonne de plus dans le JSON |
| Reconnaissance photo | **Jamais** — payante (§8) |
| Gamification (PP, rangs) | Hors V1, et à manier avec prudence (§8, santé) |

**Pourquoi ce périmètre.** Même raisonnement qu'Astra et Orbite : la V1 doit être *utilisable
seule, tous les jours*, avant d'être complète. Le journal, l'objectif et les deux raccourcis
anti-friction (récents, copier un repas) forment déjà un outil complet ; tout le reste s'ajoute
sans migration du modèle.

---

## 6. Le modèle de données

Tables préfixées par le nom technique `nutrition`, toutes avec `user_id`, leurs quatre
politiques RLS et un index sur `user_id` (`CLAUDE.md` §5). **CIQUAL n'a pas de table** : il vit
dans le JSON embarqué (§4).

### `nutrition_foods` — aliments personnels et produits scannés

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `user_id` | uuid | |
| `source` | text, CHECK `custom` / `off` | Saisi à la main, ou recopié d'Open Food Facts |
| `barcode` | text, nullable | Code EAN ; **unique par utilisateur** quand il existe (index partiel, même motif que `import_key` d'Astra) |
| `name`, `brand` | text | |
| `kcal`, `protein`, `carbs`, `fat`, `fiber` | pour 100 g | `fiber` nullable (pas toujours sur l'étiquette) |
| `serving_grams` | nullable | « 1 pot = 125 g » |
| `favorite` | boolean | |
| `created_at` | timestamptz | |

### `nutrition_entries` — ce qui a été mangé

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `user_id` | uuid | |
| `day` | date | Jour local, comme partout dans Atlas |
| `meal` | text, CHECK `breakfast` / `lunch` / `dinner` / `snack` | |
| `food_id` | uuid, nullable, `on delete set null` | Aliment perso ou scanné… |
| `ciqual_code` | text, nullable | …ou aliment CIQUAL — exactement l'un des deux au départ |
| `label` | text | Le nom **au moment de la saisie** |
| `grams` | quantité mangée | |
| `kcal`, `protein`, `carbs`, `fat` | **valeurs figées** pour cette quantité | |
| `created_at` | timestamptz | |

**Les valeurs sont figées à l'enregistrement**, comme les PP dans les check-ins de Zénith
(`CLAUDE.md` §6). Corriger un aliment perso, ou passer à la version suivante de CIQUAL, ne doit
jamais réécrire ce que l'utilisateur a mangé le mois dernier. C'est aussi ce qui permet le
`on delete set null` : supprimer un aliment perso ne fait disparaître aucune ligne du journal —
même philosophie que « à classer » dans Astra.

### `nutrition_targets` — les objectifs, datés

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `user_id` | uuid | |
| `effective_from` | date | L'objectif s'applique à partir de ce jour |
| `protein`, `carbs`, `fat` | grammes par jour | les kcal s'en déduisent (4/4/9) et ne sont pas stockées — décision du 25/09/2026 (§12) |

Daté plutôt qu'une ligne unique : si Jules passe de 2 500 à 2 200 kcal en octobre, ses jours
de septembre doivent rester jugés contre 2 500. L'objectif d'un jour est celui de la ligne la
plus récente dont `effective_from` est antérieur ou égal à ce jour.

### Unités et cohérence TypeScript ↔ SQL

- Proposition : stocker des **entiers** — kcal entières, macros en **dixièmes de gramme** —
  comme Astra stocke des centimes, pour ne jamais accumuler d'erreurs de flottants en
  additionnant. À confirmer à l'étape 1.
- `MEALS` et `FOOD_SOURCES` en tableaux `as const`, avec un test qui les compare aux CHECK de
  la migration — la discipline de `TIER_KINDS` (`CLAUDE.md` §5).

---

## 7. Les bibliothèques pures, testées avant tout écran

Même discipline que `lib/boxes.ts` d'Orbite ou `lib/monthlyBreakdown.ts` d'Astra :

- `lib/macros.ts` — valeurs pour une quantité donnée, totaux d'un repas et d'un jour, part de
  chaque macro dans l'énergie, conversion % ↔ grammes (4/4/9).
- `lib/foodSearch.ts` — recherche insensible aux accents et à la casse (« creme » trouve
  « crème »), sur plusieurs mots (« poulet roti »), récents et favoris d'abord.
- `lib/targets.ts` — Mifflin-St Jeor × facteur d'activité ± objectif, et l'objectif en
  vigueur pour un jour donné (§6).
- `lib/day.ts` — recopié depuis Orbite (aucun import entre modules).

---

## 8. Ce qui va bloquer, ou coûter

| Obstacle | Gravité | Réponse |
|---|---|---|
| **Reconnaissance photo** de l'assiette | bloquant | Demande un modèle de vision facturé à l'appel : incompatible avec « gratuit à vie ». **Abandonnée**, pas reportée |
| **Recherche OFF** limitée à 10/min, interdite pendant la frappe | bloquant si ignoré | Recherche sur CIQUAL local + aliments perso ; OFF réservé au code-barres (§4) |
| **Scan sur iPhone** | réel | L'API native `BarcodeDetector` n'existe que sur Chrome/Android. **Safari iOS ne l'a pas**, et tous les navigateurs iOS utilisent Safari en dessous. Il faut une bibliothèque de lecture compilée en WebAssembly (famille zxing, gratuite, open source), chargée seulement à l'ouverture du scanner. Deuxième dépendance externe d'Atlas après Tiptap. Saisie du code chiffré toujours possible en secours |
| **Données OFF parfois fausses** | modéré | Source affichée ; le produit est recopié chez l'utilisateur, qui corrige sa copie |
| **CIQUAL ne connaît ni les marques ni les plats de restaurant** | modéré | Aliments perso ; OFF pour les produits emballés |
| **Hors ligne** | réel (règle n°3 de `CLAUDE.md`) | La file de Zénith n'accepte que des coches. Deux options : la généraliser dans `core/` (vrai chantier du socle, avec la clé `zenith.outbox.v1` qui ne doit pas bouger), ou lancer la V1 sans, en gardant au minimum le formulaire rempli quand l'envoi échoue. Question §11 |
| **Poids du JSON CIQUAL** | faible | Fichier séparé, chargé à la demande, taille mesurée au build |
| **Stockage Supabase** (500 Mo gratuits) | négligeable | ~15 lignes par jour et par personne ≈ 5 500 lignes par an, quelques centaines de ko |
| **Santé** | à ne pas négliger | Les chiffres sont des **estimations**, pas un avis médical — à écrire noir sur blanc dans l'aide. Pas d'alerte rouge au dépassement : l'étude comportementale déjà citée pour Astra (`docs/etude-astra.md` §12) montre qu'un voyant rouge ne change rien au comportement, et ici il peut en plus culpabiliser. Le suivi calorique est un terrain sensible pour les personnes fragiles face aux troubles alimentaires — or Atlas vise aussi « quelques proches ». D'où une teinte neutre, et une gamification (séries, rangs) à éviter ou à manier avec beaucoup de prudence |

---

## 9. Nommer le module — à trancher ensemble

Nom technique proposé : **`nutrition`** (dossier, tables `nutrition_*`, classes `.nutrition-*`).

Pour le nom affiché, dans la famille céleste (Atlas, Zénith, Astra, Orbite) :

- **Cérès** *(proposition)* — une planète naine, et la déesse romaine des moissons, qui a donné
  son nom aux **céréales**. Céleste et nourricière à la fois.
- **Vesta** — astéroïde, et déesse du foyer, donc de la cuisine.
- **Hélios** — le Soleil, source d'énergie ; plus abstrait.

---

## 10. Découpage du chantier

| Étape | Contenu | Résultat |
|---|---|---|
| 1 ✅ | Migration datée, contrat `NutritionStore` + implémentations locale et Supabase, `module.ts` avec un écran signet, inscription au registre, tests exigés par `conventions.test.ts` | le module existe, vide — **livré le 25/09/2026** |
| 2 ✅ | Script d'import CIQUAL → JSON, `lib/foodSearch.ts` + `lib/macros.ts` testées | la base est là, la règle est juste — **livré le 25/09/2026**, voir §13 |
| 3 ✅ | Journal du jour : ajout par repas, totaux, changement de jour, copier un repas, récents/favoris | **la V1 est atteinte** — livré le 25/09/2026, voir §14 (favoris reportés à l'étape 5) |
| 4 ✅ | Objectifs datés et calculateur, barres face à l'objectif | on se fixe un cap — livré le 25/09/2026, voir §15 |
| 5 | Aliments perso | tout se note |
| 6 | Code-barres : saisie du code puis caméra (OFF, mise en cache) | les produits emballés en un geste |
| 7 | File hors ligne généralisée dans `core/`, historique de la semaine | la règle n°3 tient partout |

L'ordre 4/5 peut s'inverser ; l'étape 7 peut remonter selon la réponse à §11.

---

## 11. Questions ouvertes à trancher ensemble

*Les questions 1 à 5 sont tranchées depuis : voir §12.*

1. **Le nom** : Cérès, Vesta, Hélios, ou autre ?
2. **iPhone ou Android ?** (pour Jules et les proches visés) — décide si le scan demande une
   bibliothèque WebAssembly ou peut s'appuyer sur l'API native.
3. **Objectif en pourcentages ou en grammes ?** Les deux se convertissent (§2) ; la question
   est ce qu'on règle et ce qu'on déduit. Les grammes collent mieux à un objectif protéines en
   g/kg ; les pourcentages aux repères ANSES.
4. **Le scan dès la V1**, ou après ?
5. **Hors ligne** : généraliser la file de Zénith avant la V1, ou après ?
6. **Suivi du poids** et objectif adaptatif à la MacroFactor : envie, pour plus tard ?
7. **Lien avec Zénith** (par exemple « atteindre mon objectif protéines » comme action
   cochée) : impossible par import direct entre modules, il faudrait un mécanisme du socle —
   à écarter tant qu'il n'y a pas de besoin précis ?

---

## 12. Décisions prises avec Jules (25/09/2026)

| Question (§11) | Décision | Conséquence |
|---|---|---|
| 1. Nom | **Cérès** | `label: 'Cérès'` dans `module.ts` ; le nom technique reste `nutrition` |
| 2. iPhone ou Android | **iPhone** | le jour du scan, l'API native `BarcodeDetector` ne suffira pas : bibliothèque WebAssembly (famille zxing) chargée à la demande, et saisie du code chiffré en secours |
| 3. Objectif en % ou en grammes | **En grammes** | on règle les grammes de protéines, glucides et lipides ; les kcal et les pourcentages en sont **déduits** (4/4/9), jamais l'inverse. Les repères ANSES en % ne sont qu'une aide affichée à côté |
| 4. Scan en V1 | **Plus tard** | le périmètre V1 (§5) est inchangé ; le scan reste l'étape 6 |
| 5. File hors ligne avant ou après la V1 | **Après la V1** | l'étape 7 (§10) reste à sa place ; en attendant, une saisie qui échoue faute de réseau doit au minimum laisser le formulaire rempli, pour ne rien perdre de ce qui a été tapé |
| 6–7. Poids adaptatif, lien avec Zénith | *pas encore tranchés* | hors V1 de toute façon |

**Objectif en grammes : ce que ça change.** Le calculateur de §2 propose toujours un chiffre de
départ en kcal, mais le réglage enregistré est un triplet de grammes. La cible kcal d'un jour
vaut donc `4 × protéines + 4 × glucides + 9 × lipides` : elle ne peut jamais contredire les
macros, puisqu'elle n'est pas stockée à part. Les protéines peuvent aussi se proposer en g/kg
de poids, si l'utilisateur donne son poids au calculateur. Conséquence sur §6 :
`nutrition_targets` perd sa colonne `kcal`.

---

## 13. Étape 2 : la table CIQUAL embarquée (25/09/2026)

**Source.** Les fichiers XML officiels de la version 2025 (`alim_2025_11_03.xml` pour les noms,
`compo_2025_11_03.xml` pour les teneurs), sur recherche.data.gouv.fr, Licence Ouverte /
Etalab 2.0. Le script `src/modules/nutrition/scripts/import-ciqual.mjs` les convertit en
`src/modules/nutrition/data/ciqual.json`, commité avec le code. Il ne se relance qu'à la
sortie d'une nouvelle version de la table. Les XML eux-mêmes (70 Mo) ne sont pas commités.

**Constituants retenus :** énergie règlement UE 1169/2011 en kcal (code 328), protéines
N × facteur de Jones (25000), glucides (31000), lipides (40000), fibres (34100). L'alcool
(60000) ne sert qu'à recalculer une énergie manquante.

**Règles de conversion** (`lib/ciqualImport.ts`, testées) :

| Valeur écrite par l'ANSES | Lue comme | Pourquoi |
|---|---|---|
| « 12,5 » | 12,5 | virgule décimale française |
| « traces », « < 0,5 » | 0 | sous le seuil de mesure : moins que l'arrondi au décigramme qu'on en fait de toute façon |
| « - » | **inconnue** | pas mesurée — ce n'est pas zéro |
| kcal inconnues | recalculées | 4/4/9 + 7 pour l'alcool + 2 pour les fibres (règlement UE) : sans l'alcool, un pastis vaudrait 0 kcal. **62 aliments** concernés |
| protéines, glucides ou lipides inconnus | **aliment écarté** | une fausse valeur qu'on ne voit pas est pire qu'un aliment absent, qu'on remplace par un aliment perso. **99 aliments** concernés (jus de canneberge, jarret de bœuf cru, riz précuit…) |
| fibres inconnues | `null` | les fibres ne comptent pas dans les totaux, seulement dans l'affichage |

**Résultat : 3 385 aliments sur 3 484**, triés par nom. Le fichier pèse **260 Ko bruts, 72 Ko
compressés**. Chaque aliment est un tableau `[code, nom, kcal, protéines, glucides, lipides,
fibres]` plutôt qu'un objet, ce qui divise le poids par deux. Le chargement passe par un import
dynamique (`lib/ciqual.ts`, `loadCiqual`) : Vite en fera un fichier à part, téléchargé à la
première recherche seulement. Son poids réel dans le build se mesurera à l'étape 3, quand un
écran l'importera pour de bon.

**Recherche** (`lib/foodSearch.ts`) : chaque mot tapé doit être le début d'un mot du nom,
sans tenir compte des accents, de la casse, des ligatures (« oeuf » trouve « Œuf ») ni d'un
pluriel en -s/-x. Ordre des résultats : priorité (récents, favoris, à brancher à l'étape 3),
puis les noms qui commencent par le premier mot tapé, puis les plus courts (les plus
génériques). Un test tourne sur la vraie table embarquée, pour qu'une régénération ratée
(colonne décalée, mauvais fichier) casse un test plutôt que d'afficher de fausses valeurs.

**Calculs** (`lib/macros.ts`) : valeurs pour une quantité (arrondies une seule fois, au moment
de figer l'entrée), sommes, kcal d'un objectif en grammes, part de chaque macro dans l'énergie
(calculée depuis les grammes, arrondie pour faire exactement 100 %), conversion
pourcentage → grammes pour le futur calculateur.

---

## 14. Étape 3 : le journal du jour, la V1 (25/09/2026)

**Ce que fait l'écran.** Un jour à la fois (flèches, plus un bouton « Aujourd'hui » dès qu'on
s'en éloigne), le total en tête : kcal, puis protéines, glucides et lipides en grammes, avec leur
part de l'énergie. En dessous, les quatre repas, chacun avec son total, ses aliments (nom,
quantité, kcal), un bouton « + Ajouter », et « Copier d'hier (n) » quand la veille a quelque
chose sous ce repas. Toucher une ligne ouvre la correction de quantité, avec « Retirer ».

**Ajouter un aliment** (`components/AddFoodDialog.tsx`). La table CIQUAL se télécharge à la
première ouverture de cette fenêtre, pas avant : elle est dans son propre fichier au build
(`ciqual-….js`, 243 Ko, **73 Ko compressés**), la mesure prévue en §13 est faite. Sans rien
taper, la fenêtre propose les aliments mangés dans les 60 derniers jours, le plus récent
d'abord. En tapant, ces mêmes aliments passent devant dans les résultats. Choisir un aliment
propose la quantité de la dernière fois, sinon la portion de l'aliment perso, sinon 100 g, avec
un aperçu des valeurs avant d'ajouter.

**Choix faits en chemin :**

- **Corriger une quantité remet à l'échelle les valeurs figées** (`rescaleEntry`), sans relire
  l'aliment d'origine, qui a pu être corrigé ou supprimé depuis. L'entrée reste l'aliment tel
  qu'il était quand on l'a noté (§6).
- **« Copier » ne propose que la veille** du jour affiché, repas par repas, en reprenant les
  valeurs figées. Copier depuis n'importe quel jour pourra venir plus tard si le besoin se fait
  sentir ; la veille couvre le cas « même petit-déjeuner qu'hier ».
- **Les favoris attendent l'étape 5.** La colonne `favorite` n'existe que sur les aliments perso,
  et les récents couvrent déjà l'essentiel du besoin. Marquer un aliment CIQUAL comme favori
  demanderait un stockage de plus, à décider avec les aliments perso.
- **Pas encore d'écran d'objectif** (étape 4), mais le total sait déjà en afficher un : dès qu'un
  objectif existe, chaque chiffre gagne une barre et un « / objectif ». Sans objectif, une ligne
  le dit plutôt que d'afficher des barres vides. Au-delà de l'objectif, la barre reste pleine et
  de la même couleur, jamais rouge (§8).
- **Une erreur d'enregistrement laisse la fenêtre ouverte et remplie** (décision §12 : la file
  hors ligne vient après la V1). La copie d'un repas écrit ligne par ligne : si le réseau lâche
  au milieu, ce qui est copié reste et l'erreur s'affiche.
- La mention « Ciqual 2025, ANSES » et « des estimations, pas un avis médical » sont en pied de
  page (§4, §8).

**Une limite de la table, pas de l'app :** CIQUAL 2025 n'a par exemple pas de « poulet rôti »,
seulement cru et grillé/poêlé. Ce genre de trou se comblera avec les aliments perso (étape 5).

---

## 15. Étape 4 : l'objectif quotidien (25/09/2026)

**La fenêtre** (`components/TargetEditor.tsx`) s'ouvre depuis le total du jour : « Fixer un
objectif » quand il n'y en a pas, « Objectif » sinon. On y règle **trois nombres en grammes**
(décision §12) ; les kcal (« Soit 2 190 kcal par jour ») et la part de chaque macro dans
l'énergie se calculent à côté, en direct, avec le repère ANSES de chacune (« 25 % de
l'énergie · repère ANSES 10–20 % »). Le repère est une aide : rien n'est bloqué ni coloré
quand on en sort.

**Daté.** « À partir du » vaut aujourd'hui par défaut. Un objectif posé aujourd'hui ne change
rien aux jours d'avant ; en reposer un le même jour le remplace (une seule ligne par jour, §6).
La fenêtre liste les objectifs enregistrés (« Depuis aujourd'hui — 2 190 kcal (140 / 250 /
70 g) »), chacun avec « Retirer ».

**Le calculateur** (`lib/targets.ts`, testé), replié par défaut sous « M'aider à calculer » :
sexe, âge, poids, taille, niveau d'activité (1,2 à 1,9), but (perdre −15 %, maintenir, prendre
+10 % : en pourcentage plutôt qu'en kcal fixes, un même écart ne pèse pas pareil sur 1 700 et
sur 3 000 kcal), protéines en g/kg (0,83 / 1,6 / 2). Il calcule :

1. dépense = métabolisme de base (Mifflin-St Jeor) × activité × but ;
2. protéines = poids × g/kg ;
3. lipides = 35 % de l'énergie, le bas de la fourchette ANSES ;
4. glucides = le reste, jamais négatif.

Les kcal affichées sont celles des grammes proposés, pas la dépense brute : les deux chiffres ne
peuvent pas se contredire. « Utiliser ces valeurs » remplit les trois champs, **rien n'est
enregistré sans « Enregistrer »**, et le poids, la taille et l'âge ne sont stockés nulle part —
pas de nouvelle donnée de santé en base pour un simple point de départ. Le texte le dit :
estimation à ±10–15 %, pas un avis médical.

**Au journal**, dès qu'un objectif est en vigueur pour le jour affiché : « 824 / 2 190 kcal »,
une barre sous les kcal et sous chaque macro, « / 140 g » à côté des grammes. Les barres
s'arrêtent pleines au-delà, sans changer de couleur (§8).

Au passage, « Aujourd'hui » prend l'apostrophe typographique (’) comme le reste de l'interface.

---

## Sources

- Table Ciqual 2025, ANSES — [présentation](https://ciqual.anses.fr/cms/en/2025-anses-ciqual-table),
  [jeu de données (recherche.data.gouv.fr)](https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi%3A10.57745%2FRDMHWY)
- Open Food Facts, [documentation de l'API](https://openfoodfacts.github.io/openfoodfacts-server/api/)
  (limites, User-Agent, licence) ; en-têtes CORS vérifiés par un appel réel le 25/09/2026
- `BarcodeDetector` : [MDN](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector),
  [Can I use](https://caniuse.com/mdn-api_barcodedetector),
  [le cas iOS et WebAssembly](https://dev.to/ilhannegis/barcode-scanning-on-ios-the-missing-web-api-and-a-webassembly-solution-2in2)
- Marché : [le paywall MyFitnessPal de 2024](https://www.caloriescanai.com/blog/what-the-myfitnesspal-paywall-changed),
  [MacroFactor vs Cronometer 2026](https://aifithub.io/articles/macrofactor-vs-cronometer-2026/),
  [alternatives à MyFitnessPal 2026](https://useprotrack.com/blog/best-myfitnesspal-alternatives)
  — prix relevés en septembre 2026, susceptibles d'évoluer
