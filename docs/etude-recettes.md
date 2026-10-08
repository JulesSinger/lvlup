# Recettes — étude du onzième module

*Étude de conception, écrite avant le code — même exercice que `docs/etude-sport.md` et
`docs/etude-projets.md`. Objectif : voir ce que fait le marché, ce qu'on peut faire sans rien
payer (en particulier : récupérer une recette depuis un site), et ce que le module échange avec
le reste d'Atlas — Courses et Nutrition d'abord. Les décisions qui reviennent à Jules sont
regroupées en fin de document (§11).*

Demande de Jules (08/10/2026) : « étudie le prochain module de recette ». Le module figurait
dans la liste des modules possibles proposée le 07/10/2026, comme celui qui relierait Courses
(acheter ce qu'il faut) et Nutrition (ce qu'on mange).

---

## 1. Ce que le module est, et ce qu'il n'est pas

**Un carnet de recettes personnel** : les recettes que Jules cuisine ou veut cuisiner, venues
d'un site en un collage de lien, d'un texte copié, ou tapées à la main ; qu'on retrouve en deux
secondes, qu'on ajuste au nombre de personnes, qu'on suit pas à pas en cuisinant, et dont les
ingrédients partent dans la liste de courses d'un geste.

**Ce qu'il n'est pas** :
- **un site de recettes** : pas de catalogue à parcourir, pas de recettes « suggérées ». Le
  carnet ne contient que ce que Jules y met ;
- **un réseau social** (règle n°2) : pas de partage, pas de commentaires d'autres personnes ;
- **un générateur par IA** (règle n°1) : ni « invente-moi une recette », ni lecture d'une photo
  de livre par un modèle payant ;
- **une gestion de stock** (« qu'est-ce que j'ai dans mon frigo ») : la tenir à jour est une
  corvée que presque personne ne fait plus d'une semaine. Une recherche « avec ce que j'ai »
  sur les ingrédients suffit (§4.4).

Frontière avec **Courses** : Courses sait ce qu'on achète ; Recettes sait ce qu'on cuisine et
lui **demande** d'ajouter des articles. Frontière avec **Nutrition** : Nutrition tient le journal
de ce qu'on mange ; Recettes peut lui dire « une part de lasagnes, c'est tant de kcal ».

---

## 2. Le marché, et ce qu'on en retient

| Application | Ce qui la distingue | Prix |
|---|---|---|
| **Paprika** | la référence depuis dix ans : import d'un site en un geste, liste de courses, menus, mode cuisine, tout hors ligne | ~5 $ sur iPhone, ~30 $ sur ordinateur, achat par appareil |
| **Mela** | très soignée sur Apple, import, « flux » des blogs suivis, mode cuisine avec minuteurs | gratuite avec limite, ~7 $ sur iPhone |
| **Crouton** | mode pas à pas, menus, liste générée ; import par photo (IA) dans l'abonnement | gratuit limité, 25 $ ou 15 $/an |
| **Mealie** (libre) | à héberger soi-même ; import par les données schema.org des sites, menus, liste | gratuit, demande un serveur |
| **Jow, Cookidoo, Marmiton** | catalogues d'un éditeur (Jow relié à un drive, Cookidoo au Thermomix) | gratuits ou abonnement |

Sources : pages de l'App Store et comparatifs cités en fin de document. Les prix varient d'un
pays et d'une date à l'autre : ils situent, ils ne comptent pas.

**Ce qu'on garde** :
1. **L'import depuis un lien**, qui fait tout le confort de Paprika et Mela (§3).
2. **Ajuster le nombre de personnes**, quantités recalculées et arrondies proprement
   (« 1,5 oignon », pas « 1,4999 »).
3. **Le mode cuisine** : une étape à la fois, en gros, écran qui ne s'éteint pas, minuteurs
   tirés du texte (« cuire 25 minutes » → un bouton 25:00).
4. **Les ingrédients vers la liste de courses**, en évitant ce qu'on a toujours (sel, poivre,
   huile).
5. **Le menu de la semaine** : poser des recettes sur des jours, puis envoyer d'un geste les
   ingrédients de toute la semaine à Courses. C'est la fonctionnalité qui relie le plus de
   modules, et celle que tous les concurrents mettent en avant.
6. **L'historique** : « faite le 12 mars, 4/5, moins de sel la prochaine fois ».

**Ce qu'on laisse** : les catalogues, les flux de blogs, l'IA, le drive, le partage.

---

## 3. Faire venir une recette — vérifié

### 3.1 Depuis un site : les données schema.org

Les grands sites français décrivent leurs recettes dans un format standard caché dans la page
(JSON-LD `@type: Recipe`, pensé pour Google). **Vérifié le 08/10/2026** sur Marmiton et
CuisineAZ : on y trouve le titre, le nombre de personnes (« 8 personnes »), les temps
(`PT30M`, `PT1H35M`), la liste des ingrédients, les étapes, la catégorie et des photos. Exemple
réel, les lasagnes de Marmiton :

```
« 1 paquet de lasagnes », « 3 oignons jaunes », « 2 gousses d'ail », « 600 g de boeuf haché »,
« 15 cl d'eau », « 1 l de lait », « 3 pincées de muscade râpée », « thym », « sel »…
```

C'est ce qu'utilisent Paprika, Mela et Mealie. Les blogs qui utilisent les extensions de
recettes de WordPress le font aussi ; les petits sites, pas toujours (§8).

**Mais le navigateur ne peut pas lire la page lui-même** : aucun de ces sites n'autorise une
autre adresse à le lire (pas d'en-tête `Access-Control-Allow-Origin`, vérifié). Il faut donc
**une fonction serveur**, `recettes-import`, une Edge Function comme `sport-import` : elle va
chercher la page, en extrait la recette, et rend un brouillon que Jules relit avant
d'enregistrer. Gratuite (Supabase), à quelques règles près :
- **réservée à un compte connecté** (son jeton de session), sinon elle servirait de relais à
  n'importe qui ;
- **adresses `http(s)` publiques seulement** : jamais `localhost` ni une adresse privée (sinon
  on pourrait lui faire lire des machines internes) ; trois redirections au plus, 2 Mo au plus,
  10 secondes au plus ;
- **une page, à la demande** : c'est l'usage de Paprika ou d'un « lire plus tard », pour un
  usage personnel. Pas d'exploration de site.

La photo de la recette suit le même chemin (la fonction la rapporte, l'app la réduit et la range
comme les photos de Hauts faits, `core/data/images`).

### 3.2 Depuis un texte collé

Pour Instagram, TikTok, un message, un PDF : aucune donnée structurée. On colle le texte, et un
**analyseur maison** (comme l'ajout rapide de Tâches) repère les ingrédients (une ligne qui
commence par une quantité ou une puce) et les étapes (lignes numérotées, paragraphes), et
montre ce qu'il a compris avant d'enregistrer. Toujours corrigeable.

### 3.3 À la main

Pour un livre ou la recette de famille : titre, personnes, ingrédients (une ligne chacun, lus
par le même analyseur), étapes. Lire une **photo de page de livre** demanderait un OCR :
`tesseract.js` (gratuit, dans le navigateur, quelques Mo à télécharger) le permettrait, mais
la qualité sur une page de livre en français reste à voir. **Plus tard, si le besoin est réel.**

### 3.4 Depuis l'iPhone : le partage

L'idéal serait « Partager → Atlas » depuis Safari. **À ma connaissance, Safari ne permet pas à
une app web d'apparaître dans la feuille de partage** (« Web Share Target », pris en charge par
Chrome sur Android seulement) — à confirmer sur l'iPhone. Sur iPhone, le geste sera donc :
copier le lien, ouvrir Recettes, coller. Atlas peut proposer le lien qu'il trouve dans le
presse-papiers.

---

## 4. Les briques

### 4.1 La recette

Titre, photo, nombre de personnes (le « rendement » : 8 personnes, 12 crêpes, 1 moule),
temps de préparation, de cuisson et de repos, **ingrédients** (groupés au besoin : « Pour la
béchamel »), **étapes**, catégorie (entrée, plat, dessert, apéritif, petit-déjeuner, boisson,
base), étiquettes libres (« rapide », « végétarien », « batch cooking »), source (le lien, le
livre, « Maman »), note personnelle, favori.

### 4.2 L'ingrédient, lu

Chaque ligne garde **le texte tel quel** (« 2 gousses d'ail ») — la vérité, jamais perdue — et
sa **lecture** : quantité (2), unité (gousse), nom (ail), précision (« râpée »). Les quantités
sans unité (« 3 oignons »), les fractions (« ½ », « 1/2 »), les fourchettes (« 2 à 3 »),
« une pincée », « un peu de », « sel, poivre » sans quantité : tous cas réels de la recette de
Marmiton. Analyseur maison en français, testé sur des centaines de lignes réelles avant tout
écran (même discipline que l'ajout rapide de Tâches).

### 4.3 Ajuster les quantités

Passer de 8 à 3 personnes multiplie chaque quantité lue par 3/8, puis **arrondit à quelque
chose qui se mesure** : grammes à 5 g près, cl à 1 près, cuillères au demi, pièces au demi
(« 1,5 oignon »), et « 1 paquet » × 3/8 devient « ⅜ de paquet », signalé. Une ligne sans
quantité (« thym ») ne change pas.

### 4.4 Retrouver

Recherche instantanée sur le titre, les ingrédients et les étiquettes (toutes les recettes sont
chargées, comme les aliments de CIQUAL dans Nutrition) ; filtres par catégorie, temps total
(« moins de 30 min »), favoris, « jamais faite », « pas faite depuis longtemps ». Et
**« avec ce que j'ai »** : taper « courgette, feta » classe les recettes par nombre
d'ingrédients trouvés. Pas de stock à tenir.

### 4.5 L'historique

« Je l'ai faite » : le jour, pour combien, une note sur 5 et un mot (« doubler l'ail »). La fiche
dit « faite 4 fois, la dernière il y a 3 semaines ».

---

## 5. Les vues

- **Le carnet** : les recettes en cartes (photo, titre, temps, note), recherche et filtres en
  haut. Une recette sans photo garde une couverture à l'emblème de sa catégorie, comme Hauts
  faits.
- **La fiche** : photo, temps, personnes réglables (− 4 +), ingrédients recalculés, étapes,
  historique, « Cuisiner », « Ajouter aux courses », « Je l'ai faite ».
- **Le mode cuisine** : une étape par écran en grand, glisser pour avancer, les ingrédients de
  l'étape rappelés, les minuteurs détectés dans le texte, **l'écran qui reste allumé** (API Wake
  Lock : sur iPhone depuis iOS 16.4 dans Safari, et **dans une app installée sur l'écran
  d'accueil seulement depuis iOS 18.4** selon les sources consultées — à vérifier sur l'iPhone
  de Jules ; sans elle, un message dit de régler le verrouillage automatique).
- **Le menu de la semaine** (si retenu, §11) : sept jours, midi et soir, une recette par case,
  « Ajouter la semaine aux courses ».
- **L'import** : coller un lien ou un texte, relire le brouillon, enregistrer.

---

## 6. Les liens avec Atlas

### 6.1 Courses — le lien le plus utile

Un **service rendu par Courses** (motif d'`expenses` et de `checkins`) : `shopping.add(lignes)`.
Recettes lui envoie, pour une recette ou une semaine de menus, des lignes « nom + quantité +
pour quoi » ; Courses les range avec ses propres règles (l'article connu est retrouvé par son
nom, sinon créé avec son rayon deviné — `guessAisle` existe déjà).

Ce qu'il faut trancher côté Courses : la liste n'a **qu'une ligne par article**, avec une quantité
en texte libre. Deux recettes qui demandent des oignons donnent donc une seule ligne « oignons »,
dont la quantité devient « 3 + 2 » (ou « 5 » quand les unités concordent) et la note « lasagnes,
curry ». Avant d'envoyer, Recettes montre la liste, **décoche d'office les ingrédients
« toujours là »** (sel, poivre, huile, sucre, farine… liste réglable) et laisse décocher ce qu'on
a déjà.

### 6.2 Nutrition — utile, mais le plus coûteux

Deux usages : **les kcal et macros d'une part**, et **« j'en ai mangé une part »** qui l'inscrit
au journal du jour. Il faut pour cela relier chaque ingrédient à un aliment de CIQUAL et
connaître son poids :
- la table CIQUAL vit dans Nutrition : un **service rendu par Nutrition** (`foods.search`,
  `foods.per100g`, `journal.add`) ; Recettes ne l'importe jamais ;
- **le poids** : direct pour « 600 g » ou « 15 cl » (1 ml ≈ 1 g pour l'eau et le lait, densités
  pour l'huile ou la farine), estimé pour « 3 oignons » (une table de poids moyens : oignon
  ~100 g, œuf ~55 g, gousse d'ail ~5 g…), **inconnu** pour « 1 paquet » — Jules le dit une fois ;
- l'association proposée est **à relire** (« bœuf haché » → « Bœuf, haché, 15 % MG, cru »), et
  gardée pour la prochaine recette qui contient « bœuf haché ».

Le résultat reste **une estimation**, dite comme telle (cuisson, eau évaporée, huile de friture
non absorbée). Valeurs figées dans le journal à l'inscription, comme partout dans Nutrition.
C'est l'étape la plus longue du découpage : à faire en dernier, et seulement si Jules l'utilise.

### 6.3 Calendar

Le menu de la semaine en calque (« Midi : lasagnes »), comme les séances de Sport.

### 6.4 Budget, plus tard

Le coût d'une recette d'après les prix de Courses : ces prix sont par ligne, pas au kilo, donc
peu fiables pour une recette. Pas avant que Courses connaisse des prix unitaires.

---

## 7. Le modèle de données

Préfixe `recettes_`, RLS complet, identifiants choisis par l'app.

| Table | Contenu |
|---|---|
| `recettes_recipes` | titre, description, personnes et libellé du rendement, temps (minutes), catégorie, étiquettes (`text[]`), source (lien, nom), note perso, favori, **ingrédients et étapes en `jsonb`** (tableaux validés par l'app et par un `CHECK jsonb_typeof`) |
| `recettes_photos` | la photo (et peut-être celles des étapes), bucket privé `recettes`, comme Hauts faits et Projets |
| `recettes_cooked` | « je l'ai faite » : jour, personnes, note sur 5, commentaire |
| `recettes_plan` | le menu : jour, repas (midi, soir), recette, personnes |
| `recettes_settings` | les ingrédients « toujours là », les associations ingrédient → CIQUAL et les poids appris |

**Ingrédients et étapes dans la recette, pas dans des tables à part** : on les lit toujours avec
la recette, la recherche se fait dans le navigateur, et une recette s'écrit d'un bloc (pas de
recette à moitié enregistrée). Le texte brut de chaque ligne est gardé à côté de sa lecture :
améliorer l'analyseur plus tard relira les anciennes recettes sans rien perdre.

**Hors ligne** : rien à écrire en mobilité (on cuisine chez soi), mais on **lit** une recette sans
réseau (cuisine sans Wi-Fi, ou en vacances) : la dernière copie des recettes est gardée sur
l'appareil, en lecture seule.

**Sauvegarde** : le JSON emporte les recettes, pas les photos (même choix que Hauts faits).

---

## 8. Ce qui va bloquer, ou coûter

- **L'analyseur d'ingrédients en français** : c'est le cœur, et la source de toutes les erreurs
  visibles (quantités mal comprises, recettes mal ajustées). Il sera testé sur un corpus réel
  (une centaine de recettes de sites différents) avant tout écran.
- **Les sites sans données structurées** (petits blogs, Instagram) : le texte collé les couvre,
  avec plus de corrections. Un site qui change sa page casse l'import pour lui seul ; le
  brouillon le montre toujours avant d'enregistrer.
- **La seconde fonction serveur qui va chercher dehors** : à sécuriser (§3.1), et elle ne marche
  qu'avec un compte (en mode local : texte collé et saisie seulement).
- **La fusion avec la liste de Courses**, une ligne par article : à concevoir avec Courses.
- **Nutrition** : l'association à CIQUAL et les poids, longs à bien faire (§6.2).
- **L'écran qui reste allumé** dans l'app installée : dépend de la version d'iOS.
- **Le stockage** : une photo réduite pèse ~200 Ko ; 500 recettes, ~100 Mo du Go gratuit,
  partagé avec Hauts faits et Projets.

---

## 9. Nommer le module

Nom affiché proposé : **Recettes** 🍳 (règle des noms fonctionnels du 28/09/2026). Nom
technique `recettes`. Couleur : une teinte encore libre de la palette (pêche ou citron vert),
à choisir à l'étape 1.

---

## 10. Découpage proposé (7 étapes)

1. **Le module existe** : tables, contrat et ses deux implémentations, module signet.
2. **Les règles, testées avant tout écran** : analyseur d'ingrédients, ajustement et arrondis,
   durées `PT1H35M`, extraction schema.org, analyse d'un texte collé, minuteurs dans les étapes,
   recherche et « avec ce que j'ai ».
3. **La V1** : carnet, fiche avec personnes réglables, saisie à la main et texte collé, « je
   l'ai faite », photo.
4. **L'import depuis un lien** : la fonction `recettes-import`, sa sécurité, la photo rapportée.
5. **Le mode cuisine** : étapes, minuteurs, écran allumé, lecture hors ligne.
6. **Courses et le menu de la semaine** : le service de Courses, la liste à relire, le menu et
   son calque dans Calendar.
7. **Nutrition** : associations à CIQUAL, poids, kcal par part, « j'en ai mangé une part ».

---

## 11. Questions à trancher ensemble

1. **Le nom** : « Recettes » 🍳 te va ?
2. **D'où viennent tes recettes**, surtout : des sites (Marmiton, blogs), des réseaux (Instagram,
   TikTok), des livres, des recettes de famille, les tiennes ? Ça décide de la priorité entre
   l'import par lien, le texte collé et la saisie.
3. **Combien en as-tu à reprendre** au départ, et où sont-elles aujourd'hui (notes, captures
   d'écran, favoris Marmiton, une autre app) ?
4. **Le menu de la semaine** : tu planifies tes repas, ou tu choisis au jour le jour ? Dans la
   V1, ou plus tard ?
5. **Courses** : envoyer les ingrédients d'une recette (ou d'une semaine) à la liste, oui ?
   Quels ingrédients as-tu toujours chez toi ?
6. **Nutrition** : calculer les kcal d'une part et l'inscrire au journal t'intéresse ? Tu
   utilises Nutrition aujourd'hui ? (C'est l'étape la plus coûteuse : je la mettrais en dernier.)
7. **Le mode cuisine** : utile, avec ton iPhone posé dans la cuisine ? Quelle version d'iOS
   (≥ 18.4 pour l'écran qui reste allumé dans l'app installée) ?
8. **Les photos** : une par recette, ou aussi celles de tes propres plats ?
9. **Pour qui** : toi seul, ou des recettes que quelqu'un d'autre consulterait (ce qui irait
   contre la règle n°2 pour l'instant) ?

---

## Sources

- Données schema.org des recettes, vérifiées le 08/10/2026 sur
  [Marmiton](https://www.marmiton.org/recettes/recette_lasagnes-a-la-bolognaise_18215.aspx) et
  [CuisineAZ](https://www.cuisineaz.com/recettes/lasagnes-a-la-bolognaise-56300.aspx) (JSON-LD
  `Recipe` présent, aucun en-tête `Access-Control-Allow-Origin`).
- [Mealie](https://github.com/mealie-recipes/mealie), import par les données schema.org
  ([revue](https://cooklang.org/blog/40-mealie-review/), [guide d'import](https://selfhosting.sh/foundations/recipe-import-guide/)).
- Paprika : [App Store, prix relevés](https://apppricinglab.com/app/apple/1303222868) ;
  Mela et Crouton : [comparatifs RecipeSage](https://recipesage.com/alternatives/mela/)
  (concurrent, à lire comme tel), [Crouton sur l'App Store](https://apps.apple.com/app/id1461650987),
  [Mela, iPhoneSoft](https://iphonesoft.fr/2024/08/31/mela-app-recettes-cuisine-ultime-ios-macos).
- Écran allumé (Wake Lock) dans une app installée sur iPhone :
  [Progressier](https://progressier.com/pwa-capabilities/screen-wake-lock),
  [bogue WebKit 254545](https://webkit.org/b/254545),
  [tableau de compatibilité](https://docs.w3cub.com/browser_support_tables/wake-lock).
