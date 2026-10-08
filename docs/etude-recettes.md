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

---

## 12. Décisions prises avec Jules (08/10/2026)

1. **Nom : Recettes** 🍳.
2. **Des recettes d'un peu partout** : l'import par lien, le texte collé et la saisie à la main
   sont tous les trois utiles ; aucun ne passe avant les autres.
3. **Pas de reprise d'un existant** : on part d'un carnet vide, pas d'import en masse à prévoir.
4. **Prévoir les repas à l'avance : oui.** Le menu de la semaine entre dans le cœur du module,
   plus seulement en fin de découpage.
5. **Courses : oui, mais jamais automatiquement.** Un geste voulu (« Ajouter aux courses »
   sur une recette ou sur le menu), qui ouvre la liste des ingrédients à relire et à décocher,
   puis envoie ce qui reste coché. Rien ne part vers Courses sans ce geste : ni en ajoutant une
   recette, ni en posant un repas au menu.
6. **Nutrition : plus tard.** Jules ne l'utilise pas encore ; le lien vient après, s'il s'y met.
   Le modèle garde la place des associations aux aliments, sans les remplir.
7. **Photos : le plus économique** (choix laissé à Claude) — **une seule photo par recette**,
   réduite dans le navigateur (1 600 px de côté au plus, plus une vignette, ~200 Ko en tout),
   avec les briques du socle (`core/data/images`). Pas de photos d'étapes. Pour un import, la
   photo du site est reprise et réduite pareil : le carnet ne dépend pas d'un lien vers un site
   qui peut disparaître. Une photo de son propre plat remplace celle du site si Jules le veut.
   Sans photo, une couverture à l'emblème de la catégorie.
8. **Pour Jules seul** : pas de partage.
9. **Le mode cuisine** : expliqué à Jules (une étape à la fois, en grand, minuteurs, écran
   allumé), réponse attendue.

### Découpage révisé (7 étapes)

1. **Le module existe** : tables (`recettes_recipes`, `recettes_photos`, `recettes_plan`,
   `recettes_cooked`, `recettes_settings`), contrat et ses deux implémentations, module signet.
2. **Les règles, testées avant tout écran** : analyseur d'ingrédients, ajustement et arrondis,
   durées, extraction schema.org, texte collé, recherche, menu (semaines, repas), fusion des
   ingrédients d'une semaine.
3. **La V1** : carnet, fiche avec personnes réglables, saisie à la main et texte collé, photo,
   « je l'ai faite ».
4. **L'import depuis un lien** : la fonction `recettes-import` et la photo rapportée.
5. **Le menu de la semaine** : midi et soir, poser une recette, personnes par repas, calque dans
   Calendar.
6. **Vers Courses, à la demande** : le service rendu par Courses, la liste à relire (ingrédients
   « toujours là » décochés d'office), depuis une recette ou depuis le menu.
7. **Le mode cuisine** (si Jules le veut) ; **Nutrition** reste hors du découpage, pour plus tard.

**Mode cuisine (réponse de Jules, 08/10/2026)** : oui, **facultatif, dans l'app** — un écran qu'on
ouvre depuis une recette, jamais imposé.

## 13. Étape 1 : le module existe (08/10/2026)

- **Migration** `supabase/2026-10-08-recettes-tables.sql` : `recettes_recipes` (ingrédients et
  étapes en `jsonb`, chaque ingrédient gardé tel qu'il est écrit, avec son groupe),
  `recettes_photos` (**une par recette**, contrainte unique, bucket privé `recettes`, JPEG,
  5 Mo, chaque compte dans son dossier), `recettes_cooked` (« je l'ai faite », note de 1 à 5),
  `recettes_plan` (le menu : jour, midi ou soir, une recette **ou** un simple titre comme
  « Restes », plusieurs par case), `recettes_settings` (les ingrédients « toujours là »). RLS
  complet, quatre politiques par table.
- **Contrat** `RecettesStore` et ses deux implémentations : `LocalRecettes` (photos dans
  IndexedDB) et `SupabaseRecettes` (recettes et historique lus par paquets, `fetchAll`).
  Identifiants choisis par l'app, créations rejouables.
- **Règles déjà là** : supprimer une recette emporte sa photo (fichiers compris), son historique
  et ses places au menu ; poser une nouvelle photo remplace l'ancienne d'un coup (une seule
  ligne, `upsert` sur la recette), puis efface ses fichiers ; les fichiers avant la ligne à
  l'ajout, la ligne avant les fichiers au retrait (même ordre que Hauts faits et Projets). La
  sauvegarde garde la liste des photos, pas leur contenu.
- **Validation** (`lib/validation.ts`) : les bornes de la base dites en clair, et un lien de
  source qui doit commencer par `http(s)://`.
- Module signet, aperçu d'accueil (un menu d'exemple), couleur **`--orange`**, la dernière
  teinte chaude encore libre.
- Deux identifiants de stockage sur l'appareil, ajoutés à CLAUDE.md §4 : `atlas-recettes`
  (IndexedDB) et `recettes-photos-v1` (Cache API).

La suite de Projets cliquait un bouton « Recettes » (sa vue du livre des recettes) qui n'était
plus unique : le bouton « Ouvrir Recettes » de la barre des modules le contenait. Recherche
exacte, comme pour « Sport » dans Hauts faits.

**Migration à appliquer par Jules** avant de pousser.

## 14. Étape 2 : les règles, testées avant tout écran (08/10/2026)

- **Lire une ligne d'ingrédient** (`lib/ingredients.ts`) : quantité (chiffres, virgule, « 1 1/2 »,
  « ½ », « une », fourchette « 2 à 3 »), unité (g, kg, ml, cl, l, cuillères écrites de dix
  façons, pincée, gousse, tranche, sachet, boîte, brique, botte, brin, feuille…, « (s) »
  compris), nom, et ce qui suit (« + une noix pour le moule », « (facultatif) »). « un peu de
  sel », « Sel poivre », « thym » restent sans quantité, jamais devinés. « 1 bouquet garni » est
  un nom, pas un bouquet de « garni ». Éprouvé sur un **corpus de 89 lignes réelles** relevées
  sur Marmiton et CuisineAZ (`ingredients.corpus.ts`) : toutes celles qui commencent par un
  chiffre sont lues, et doubler une recette double chacune.
- **Ajuster au nombre de personnes** : la quantité remplacée dans le texte tel qu'il est écrit,
  arrondie à ce qui se mesure (grammes à 5 près au-delà de 50, cuillères et pièces au quart :
  « ¾ gousse d'ail »), « 1 200 g » écrit « 1,2 kg », l'unité en toutes lettres accordée
  (« 2 feuilles »), le nom compté mis au pluriel à partir de 2 (« 2 pâtes brisées », « pommes
  Golden » sans toucher au nom propre). **Jamais vers le singulier** : « radis », « ananas »,
  « pois » sont invariables, et « ¾ courgettes » se lit très bien.
- **Durées** (`lib/duration.ts`) : `PT1H35M` → 95 minutes → « 1 h 35 ».
- **Minuteurs d'une étape** (`lib/timers.ts`) : « 25 minutes », « 1 h 30 », « 20 à 25 min » (le
  plus court), « 5 mn » ; « 180°C » ou « 200 g » n'en sont pas.
- **Texte collé** (`lib/pasteText.ts`) : titre, « Pour 4 personnes », parties « Ingrédients » et
  « Préparation » quand elles sont dites, groupes (« Pour le nappage : »), étapes numérotées ;
  sans parties, une quantité ou une puce fait un ingrédient. Un brouillon, toujours relu.
- **Retrouver** (`lib/search.ts`) : chaque mot tapé dans le titre, les étiquettes, la source ou
  les ingrédients, sans accents ; filtres catégorie, « moins de N min » (une recette sans temps
  n'y entre pas), favoris, jamais faite ; **« avec ce que j'ai »** classé par ingrédients trouvés
  puis par ce qui manque (les « toujours là » ne manquent jamais) ; résumé de l'historique.
- **Le menu et la liste de courses** (`lib/menu.ts`) : semaines du lundi au dimanche, cases
  ordonnées ; une liste à relire qui additionne un même ingrédient de plusieurs recettes, chacune
  à son nombre de personnes — masses ensemble, volumes ensemble, pièces par unité, le reste bout à
  bout (« 2 + 200 g ») — et marque les « toujours là » (« Sel poivre » compris).
- **Lire la recette d'une page** (`supabase/functions/recettes-import/extract.ts`, testé par
  Vitest comme `payload.ts` de Sport) : le JSON-LD `Recipe` à n'importe quelle profondeur
  (`@graph`, `mainEntity`), le nombre de personnes (« 8 personnes », « 15 crêpes », `["6","6
  parts"]`), les temps (le repos déduit du temps total), la catégorie du site ramenée aux nôtres,
  les étapes en texte, en `HowToStep` ou en `HowToSection`, la photo, l'éditeur ; les balises et
  entités nettoyées ; les formules du site retirées du titre (« : la meilleure recette ») ; un
  « Préparation » glissé dans les ingrédients n'est pas un groupe. Essayé sur les 12 pages réelles
  relevées : toutes lues.

1529 → **1598** tests unitaires. Aucun écran : les suites de bout en bout ne changent pas.

## 15. Étape 3 : la V1 (08/10/2026)

- **Le carnet** (`Notebook`) : les recettes en cartes (photo ou emblème de la catégorie, temps
  total, note moyenne, « jamais faite », ★ des favoris), recherche, filtres (catégorie,
  « 30 min ou moins », favoris, jamais faites), et **« 🧺 Avec ce que j'ai »**, qui dit sur
  chaque carte ce qui a été trouvé et combien d'ingrédients manquent.
- **La fiche** (`RecipeSheet`) : photo, temps, source (lien), étiquettes, « faite N fois, la
  dernière le… », ma note, **ingrédients groupés et ajustés au nombre de personnes** (− 4 +,
  « Quantités ajustées pour 6 personnes »), étapes numérotées, historique, favori, modifier,
  supprimer après confirmation.
- **La fenêtre d'une recette** (`RecipeEditor`) : **Saisir** (titre, catégorie, personnes et ce
  qu'elles comptent, temps en « 25 », « 45 min » ou « 1 h 30 », ingrédients une ligne chacun —
  une ligne qui finit par « : » ouvre un groupe —, étapes une ligne chacune, photo, puis source,
  étiquettes, description et note repliées) ou **Coller un texte**, lu en brouillon qu'on relit
  avant d'enregistrer (`lib/editorText.ts`).
- **La photo** : réduite dans le navigateur (1 600 px et une vignette de 600), posée **après** la
  recette — une photo qui échoue ne fait jamais perdre la recette, un message le dit.
- **« Je l'ai faite »** (`CookedDialog`) : le jour, pour combien, une note en étoiles, un mot pour
  la prochaine fois.

Vu sur captures : sans photo, la couverture prenait un demi-écran de téléphone — ramenée à une
bande. « Avec ce que j'ai » montrait les mots repliés (« oeuf ») : ils sont dits tels que tapés.

1598 → **1603** tests unitaires ; suite de Recettes 5 → **31** (une vraie photo JPEG, le
rechargement, 390 et 320 px) ; **1166/1166** en local et en mode comptes.
