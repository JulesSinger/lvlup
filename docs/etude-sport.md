# Sport — étude du dixième module (la course à pied)

*Étude de conception, écrite avant le code — même exercice que `docs/etude-projets.md` et
`docs/etude-hauts-faits.md`. Objectif : voir ce que fait le marché, comment faire venir dans
Atlas des sorties qui sont déjà enregistrées ailleurs (sans rien payer), et ce que le module
échange avec le reste d'Atlas. Les décisions qui reviennent encore à Jules sont regroupées en
fin de document (§11).*

Demande de Jules (07/10/2026) : « fais l'étude du module Sport », après une liste de modules
possibles où Sport était recommandé parce qu'il ferait vivre Objectifs : « Courir un marathon »
se coche aujourd'hui à la main, alors que chaque sortie est déjà mesurée par la montre.

**Ce que Jules a précisé avant la rédaction (07/10/2026)** :

1. **Le sport suivi : la course à pied.** Le reste (vélo, musculation, sports collectifs)
   viendra peut-être, l'étude ne le conçoit pas.
2. **Comment il enregistre aujourd'hui** : il lance la séance dans l'app Exercice de l'**Apple
   Watch** ; à la fin, la séance est rangée dans **Santé** sur l'iPhone, puis envoyée
   automatiquement **sur Strava**.
3. **Ce qu'il attend du module** : **voir sa progression**, **suivre un programme**, et **faire
   avancer ses objectifs**. Pas d'abord un carnet de saisie : les sorties existent déjà, il
   faut les faire venir.

---

## 1. Ce que le module est, et ce qu'il n'est pas

**Ce qu'il est** : le carnet de la course à pied, alimenté sans geste par la montre, qui montre
la progression (volume, allure, records) et suit un programme vers une course datée.

**Ce qu'il n'est pas** :
- **un enregistreur GPS.** La montre enregistre déjà, et mieux qu'une page web ne le pourrait :
  un navigateur sur iPhone n'enregistre pas le GPS écran éteint ;
- **un réseau social.** Ni kudos, ni classement, ni segments (règle n°2 : pas de
  fonctionnalité sociale tant que les utilisateurs se comptent sur une main) ;
- **un coach qui réécrit le plan chaque jour.** Le programme est généré une fois, selon des
  règles qu'on peut lire, puis modifié à la main. Un plan « adaptatif » (Runna) demande des
  données et un modèle qu'on ne saurait pas justifier ;
- **un outil médical.** La fréquence cardiaque est affichée si elle existe, sans zones ni
  conseils de santé.

**Frontière avec Objectifs.** Sport sait **ce qui a été couru** (10,2 km en 58 min, mardi).
Objectifs sait **pourquoi** (« Courir un marathon », palier « 100 km cumulés »). Le lien se fait
dans un sens : une sortie enregistrée dans Sport coche l'action correspondante d'Objectifs (§6).
Les deux ne se recopient pas l'un l'autre.

---

## 2. Le marché, et ce qu'on en retient

| Outil | Ce qu'il fait bien | Prix | Ce qu'on retient |
|---|---|---|---|
| **Strava** | Journal, records par distance (« meilleurs efforts »), tendances, segments | Gratuit, analyses et plans en abonnement | Les records par distance, le volume par semaine |
| **Runna** | Plans personnalisés vers une course, allures cibles par séance | Abonnement | Le plan daté, la séance du jour avec son allure |
| **Nike Run Club** | Plans gratuits, séances guidées | Gratuit | La preuve qu'un plan simple suffit à beaucoup |
| **Garmin Coach** | Plans adaptatifs | Gratuit avec une montre Garmin | — (Jules n'a pas de Garmin) |
| **Runalyze, intervals.icu** | Analyse poussée sur le web (charge, forme, prédictions) | Gratuits | La prédiction de temps ; la charge d'entraînement, en V2 au mieux |

**Ce qu'on garde** : le volume par semaine, les records par distance, l'allure qui baisse à
effort égal, un plan daté vers une course avec trois sortes de séances (footing, fractionné,
sortie longue), la prédiction d'un temps de course.

**Ce qu'on laisse** : le social et les segments (règle n°2), la carte des sorties (§8), la
charge d'entraînement détaillée (ATL, CTL, « forme »), qui demande la fréquence cardiaque de
chaque seconde et un modèle qu'il faudrait expliquer avant de s'en servir.

---

## 3. Faire venir les sorties — le point dur

C'est la question qui décide du module : si les sorties ne viennent pas toutes seules, il
redevient un carnet de saisie, ce que Jules ne veut pas. Quatre chemins ont été vérifiés.

### 3.1 L'API de Strava : écartée

Strava est le chemin naturel : les sorties de Jules y arrivent déjà. Mais **depuis le 1er juin
2026, un nouveau développeur doit avoir un abonnement Strava payant pour accéder à l'API**
(11,99 $ par mois aux États-Unis), y compris pour une application personnelle qui ne lit que ses
propres données. Strava l'a annoncé dans « An Update To Our Developer Program » : la demande, le
moissonnage et les abus l'ont conduit à revoir l'accès. C'est contraire à la règle n°1
d'Atlas (aucun service payant).

S'y ajoutent des contraintes techniques : des jetons d'accès valables six heures, à renouveler
côté serveur, une limite de requêtes (100 toutes les 15 minutes, 1 000 par jour pour la
lecture), et un changement d'adresse de l'API au 1er septembre 2026.

Une exception : **si Jules est déjà abonné à Strava** pour son propre usage, l'API lui est
ouverte sans coût supplémentaire. Ce n'est pas le chemin retenu (Atlas dépendrait d'un
abonnement), mais la question est posée (§11).

Ce qui reste gratuit chez Strava : **télécharger ses propres données**, une sortie à la fois
(« Exporter le GPX ») ou toute l'archive du compte.

### 3.2 Apple Santé : pas d'accès depuis le web

HealthKit, qui donne accès aux données de Santé, n'existe que pour une application iOS
installée. Une application web, même installée sur l'écran d'accueil comme Atlas, ne peut pas
le lire. L'export manuel de Santé existe, mais c'est une archive de tout le compte, à refaire
à la main : inutilisable au quotidien.

### 3.3 Retenu : un raccourci iPhone

L'app **Raccourcis** d'Apple offre exactement le pont qui manque, gratuitement :
- un **déclencheur d'automatisation « Exercice sur Apple Watch »**, qui se lance au début, à la
  fin, ou aux deux, d'une séance — d'un type choisi (course) ou de toutes (documentation
  d'Apple, « Event triggers in Shortcuts ») ;
- une action qui **lit les entraînements enregistrés dans Santé** ;
- une action qui **envoie le résultat à une adresse web**.

Le chemin proposé :

1. Jules termine sa course sur la montre. La séance part dans Santé, comme aujourd'hui (et sur
   Strava, comme aujourd'hui).
2. L'automatisation se déclenche, lit le dernier entraînement de course et l'envoie à une
   fonction d'Atlas : `sport-import`, une Edge Function Supabase comme `send-reminders`.
3. La fonction reconnaît Jules par un **jeton d'import personnel**, créé dans les réglages de
   Sport, montré une seule fois, révocable. Seule son empreinte est rangée en base, comme pour
   un mot de passe. La fonction écrit la sortie, et n'accepte rien d'autre.
4. La sortie apparaît dans Sport à la prochaine ouverture.

Le raccourci serait **fourni tout fait** (un lien iCloud à installer une fois, plus les
instructions pour coller le jeton). Aucun geste ensuite.

**Ce que ce chemin apporte** : la date, l'heure, la durée, la distance, l'énergie et la
fréquence cardiaque moyenne de la séance. **Ce qu'il n'apporte probablement pas** : le tracé GPS
et les temps au kilomètre. Ce que Santé expose exactement à Raccourcis reste **à vérifier sur
l'iPhone de Jules** avant l'étape 4 : c'est la pièce la moins maîtrisée de l'étude (§8).

Deux réserves honnêtes :
- une automatisation peut demander une confirmation selon la version d'iOS et le réglage choisi
  (« Exécuter immédiatement ») : à essayer ;
- sans réseau à la fin de la séance, l'envoi échoue. Le raccourci peut prendre les
  entraînements des sept derniers jours plutôt que le dernier : la fonction ignore ceux qu'elle
  a déjà (§3.5), et un oubli se rattrape au passage suivant.

### 3.4 En complément : un fichier GPX ou FIT

Pour le détail d'une sortie (tracé, temps au kilomètre), Jules peut exporter le GPX d'une
sortie depuis Strava (gratuit) et le déposer dans Sport. Ou exporter l'archive complète du
compte Strava, une fois, pour **reprendre tout l'historique** au démarrage du module.

- Le **GPX** est du XML : lu dans le navigateur, sans dépendance.
- Le **FIT** est binaire : `fit-file-parser` (licence MIT, accepte un `ArrayBuffer`, donc
  utilisable dans le navigateur) le lit. À ne charger qu'à la première importation d'un FIT,
  comme le lecteur de code-barres de Nutrition.

Avec un tracé, les **records au sein d'une sortie** deviennent calculables (le meilleur 5 km
d'un semi-marathon), comme les « meilleurs efforts » de Strava.

### 3.5 Toujours : la saisie à la main, et jamais de doublon

Une sortie sans montre se note à la main (distance, durée, jour).

Une même sortie peut arriver par deux chemins (le raccourci, puis le GPX de Strava). Chaque
source porte une **référence** (l'identifiant de l'entraînement dans Santé, le nom et l'heure de
départ du fichier), unique par compte, comme `import_key` pour l'import bancaire de Budget.
Un GPX qui correspond à une sortie déjà venue du raccourci (même jour, départ à quelques
minutes près, distance proche) **complète** cette sortie avec son tracé au lieu d'en créer une
seconde.

---

## 4. Les briques

### 4.1 La sortie

Le jour et l'heure de départ, la **distance** (en mètres, entier), la **durée** (en secondes,
entier), le dénivelé positif, la fréquence cardiaque moyenne si elle existe, la **sorte**
(footing, fractionné, sortie longue, course, autre), un **ressenti** facultatif de 1 à 10, une
note, la source (main, raccourci, GPX, FIT).

L'**allure** (min/km) est toujours **calculée**, jamais rangée : elle ne peut pas contredire
la distance et la durée. Même principe que les kcal de Nutrition, déduites des grammes.

La sorte se devine quand c'est possible : une sortie nettement plus longue que les autres de
la semaine est probablement la sortie longue. Mais c'est une proposition, que Jules corrige
d'un toucher, jamais une certitude affichée.

### 4.2 Les records

Les meilleurs temps sur **1 km, 5 km, 10 km, semi-marathon (21,0975 km) et marathon
(42,195 km)** :
- sur une **sortie entière** de cette distance (à quelques pour cent près, une course de 10 km
  mesurée à 10,08 km est un 10 km), toujours possible ;
- **au sein d'une sortie**, seulement avec un tracé (GPX ou FIT).

Un nouveau record se célèbre, comme un palier dans Objectifs.

### 4.3 Le programme

Une **course visée** : distance (5 km, 10 km, semi, marathon), date, temps espéré facultatif.
Le programme se **génère à rebours** depuis la date, selon des règles simples et écrites :

- **3 ou 4 séances par semaine**, sur les jours choisis par Jules ;
- une **sortie longue** qui monte de semaine en semaine ;
- une **semaine allégée toutes les quatre** (volume réduit) ;
- un **affûtage** sur les dernières semaines (moins de volume, un peu d'allure de course) ;
- des **allures cibles** tirées d'un temps de référence récent (un 10 km couru il y a moins
  de deux mois, par exemple), par la prédiction du §4.4 : footing plus lent que l'allure de
  course, fractionné plus rapide.

Chaque séance prévue a un jour, une sorte, une distance ou une durée, une allure cible et une
consigne en clair (« 6 × 800 m à 4:35/km, 2 min de récupération »). Tout est **modifiable
séance par séance** ; déplacer une séance ne recalcule pas le reste.

Une sortie faite le jour d'une séance prévue s'y rattache d'elle-même ; Jules peut la
rattacher à une autre. Le programme montre ainsi, semaine par semaine, ce qui était prévu et
ce qui a été fait. Une séance manquée reste manquée : pas de rattrapage automatique qui
surchargerait la semaine suivante.

### 4.4 La prédiction

La **formule de Riegel** : T2 = T1 × (D2 / D1)^1,06. À partir d'un 10 km en 50 min, elle
prédit un semi en environ 1 h 50. Elle est connue pour être optimiste sur le marathon quand
l'entraînement est court : la prédiction est présentée comme **une estimation**, avec la sortie
dont elle part, jamais comme un objectif.

---

## 5. Les vues

- **Le tableau de bord** : cette semaine (km faits sur km prévus, séances faites), la prochaine
  séance du programme avec sa consigne, la dernière sortie, la tendance des douze dernières
  semaines en barres.
- **Le journal** : les sorties, de la plus récente à la plus ancienne, avec distance, durée,
  allure et sorte ; filtrer par sorte.
- **La fiche d'une sortie** : tout ce qu'on sait d'elle ; avec un tracé, les temps au
  kilomètre et ses records internes.
- **La progression** : kilomètres par semaine et par mois, allure moyenne par sorte (un
  footing qui passe de 6:10 à 5:45/km à effort égal se voit ici), records et leur historique.
  Les courbes datées comme celles d'Objectifs (`lib/chartTime.ts`).
- **Le programme** : semaine par semaine, chaque séance prévue avec son état (faite, à venir,
  manquée), et le compte à rebours jusqu'à la course.

---

## 6. Les liens avec Atlas

### 6.1 Objectifs — le lien qui justifie le module

Un **service rendu par Objectifs**, sur le motif d'`expenses` (Courses → Budget, §18 de
`docs/etude-courses.md`) : le socle définit la forme, Objectifs la déclare dans sa fiche
(`provides`), Sport s'en sert, et fonctionne sans.

- Dans les réglages de Sport, Jules choisit **l'action d'Objectifs que nourrit une sortie**
  (« Sortie course » de « Courir un marathon »).
- Chaque sortie enregistrée **coche cette action le jour de la sortie, avec ses kilomètres**.
  Le palier en km, le streak, la grille des jours et les PP d'Objectifs avancent sans rien
  toucher.
- La coche porte une **référence stable** (`sport:sortie:<identifiant>`) : une sortie importée
  deux fois ne coche qu'une fois, et supprimer la sortie retire sa coche.
- Il faudra donc, **côté Objectifs**, une colonne de référence sur une coche (migration). C'est
  la seule modification d'un autre module.

Ce choix (écrire une coche) plutôt qu'Objectifs qui lirait Sport : toute la mécanique
d'Objectifs (paliers, streak, grille, PP, trophées) est construite sur les coches. En écrire
une la fait marcher telle quelle.

### 6.2 Calendar

Les séances du programme et les sorties faites, en calque (`calendarSources`, déjà additionné
entre modules), comme Projets et Tâches.

### 6.3 Les rappels

La séance du jour, au matin, avec sa consigne, par les rappels communs du socle
(`scheduleReminders`). Rien les jours sans séance.

### 6.4 Hauts faits, plus tard

Une course terminée (un semi, un marathon) pourrait être proposée comme haut fait, avec sa
date et son temps.

---

## 7. Le modèle de données

Tables préfixées `sport_`, chacune avec `user_id`, RLS et ses quatre politiques ; identifiants
choisis par l'application. Distances en **mètres** et durées en **secondes**, entiers : jamais
de flottant qu'une addition ferait dériver.

| Table | Rôle |
|---|---|
| `sport_runs` | une sortie : départ, distance, durée, dénivelé, FC moyenne, sorte, ressenti, note, source, référence de la source (unique par compte), séance rattachée |
| `sport_run_tracks` | le tracé d'une sortie importée d'un fichier : temps au kilomètre, à part pour ne pas alourdir la liste |
| `sport_plans` | une course visée : distance, date, temps espéré, temps de référence, jours d'entraînement |
| `sport_plan_sessions` | une séance prévue : jour, sorte, distance ou durée, allure cible, consigne, sortie qui l'a faite |
| `sport_settings` | l'action d'Objectifs nourrie par les sorties, les réglages de rappel |
| `sport_import_tokens` | l'empreinte du jeton d'import du raccourci, jamais le jeton lui-même |

Les sortes de sortie et de séance sont des contraintes CHECK, avec leur tableau `as const` en
TypeScript et un test qui compare les deux (CLAUDE.md §5).

**Hors ligne.** Rien à écrire en mobilité : la sortie arrive par le raccourci, la saisie à la
main se fait au calme. Pas de file hors ligne en V1, mais des identifiants choisis par l'app
dès l'étape 1, pour pouvoir s'y brancher sans migration.

---

## 8. Ce qui va bloquer, ou coûter

- **Le raccourci iPhone** est la pièce la moins maîtrisée. Ce que Santé expose exactement à
  Raccourcis (distance d'une course, fréquence cardiaque, identifiant de l'entraînement), et le
  comportement de l'automatisation (confirmation demandée ou non), se vérifient sur l'appareil,
  pas dans une suite de tests. À faire **avant** de construire l'étape 4.
- **La première fonction d'Atlas qui reçoit des données de l'extérieur.** `send-reminders`
  envoie ; `sport-import` recevra. Il faut un jeton vérifié par empreinte, une validation
  stricte (bornes de distance et de durée), une taille de requête limitée, et rien d'autre
  d'accepté.
- **Le générateur de programme.** Il faut des règles simples et explicables plutôt qu'un
  générateur « intelligent ». Les règles de §4.3 seront testées une à une, et le plan produit
  pour un semi en 10 semaines relu par Jules avant la mise en ligne.
- **La carte d'une sortie** demanderait des tuiles (OpenStreetMap, dont la politique d'usage
  interdit l'usage intensif sans serveur à soi). Ce n'est pas demandé : plus tard, peut-être.
- **Le stockage.** Un tracé complet pèse lourd ; on ne range que les temps au kilomètre (quelques
  dizaines de nombres), pas les milliers de points GPS.

---

## 9. Nommer le module

Nom affiché proposé : **Sport** 🏃, conformément à la règle des noms fonctionnels (28/09/2026).
« Course » est écarté : il se confondrait avec **Courses**, le module des listes de courses.
Nom technique : `sport`, qui laisse la place au vélo ou à la musculation plus tard sans rien
renommer.

---

## 10. Découpage proposé

1. **Le module existe** : tables, contrat `SportStore` et ses deux implémentations, module
   signet, aperçu sur la page d'accueil.
2. **Les règles, testées avant tout écran** : allures, semaines, records (sortie entière et
   au sein d'un tracé), Riegel, générateur de programme, lecture GPX et FIT.
3. **La V1** : journal, saisie à la main, fiche d'une sortie, tableau de bord.
4. **L'import automatique** : la fonction `sport-import`, le jeton, le raccourci fourni et ses
   instructions ; l'import GPX et FIT, et la reprise de l'archive Strava.
5. **La progression** : graphiques et records.
6. **Le programme** : générateur, séances dans Calendar, rappels, sortie ↔ séance.
7. **Le lien avec Objectifs** : le service, et la référence de coche côté Objectifs.

L'étape 4 dépend d'un essai du raccourci sur l'iPhone de Jules (§8).

---

## 11. Questions à trancher ensemble

1. **Es-tu abonné à Strava ?** Si oui, l'API redevient possible sans coût de plus (§3.1) : à
   comparer avec le raccourci. Sinon, le raccourci est le seul chemin automatique.
2. **D'accord pour installer un raccourci une fois** (et autoriser son automatisation) ?
3. **Une course visée**, et sa date ? Elle sert à concevoir le programme sur un vrai cas.
4. **Un temps de référence récent** (un 5 ou un 10 km chronométré) ?
5. **3 ou 4 séances par semaine**, et quels jours ?
6. **La fréquence cardiaque** : utile à afficher, ou du bruit ?
7. **Reprendre l'historique** depuis l'archive Strava au démarrage ?
8. **Le nom** : Sport ?

---

## Sources

- Strava, « An Update To Our Developer Program » —
  https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428
- Strava, « Rate Limits » — https://developers.strava.com/docs/rate-limits/
- Apple, « Event triggers in Shortcuts on iPhone or iPad » —
  https://support.apple.com/guide/shortcuts/event-triggers-apd932ff833f/ios
- `fit-file-parser` (MIT) — https://www.npmjs.com/package/fit-file-parser

---

## 12. Décisions prises avec Jules (07/10/2026)

1. **Pas d'abonnement Strava** : l'API reste écartée, **le raccourci iPhone est le chemin
   automatique**.
2. **D'accord pour installer le raccourci** une fois.
3. **La course visée : le marathon d'Annecy, fin avril 2027**, sans date officielle à ce jour.
4. **Des temps existent** dans l'app Forme et sur Strava : ils viendront avec l'historique.
5. **3 ou 4 séances par semaine, sans jours fixes.**
6. **La fréquence cardiaque est très utile.**
7. **Reprendre l'historique** au démarrage : oui.
8. **Le nom : Sport** 🏃.

Et une consigne qui donne au module son centre : **« le module doit me permettre de créer un
plan pour réussir mon marathon »**.

### Ce que ces décisions changent

**Le plan marathon devient le cœur du module**, et non une étape parmi d'autres. Il remonte
dans le découpage (étape 4, juste après les données), et le tableau de bord s'organise autour
de lui : la semaine en cours du plan, la séance suivante, le compte à rebours.

**Une date à confirmer.** Le plan se construit sur une **date provisoire, le dimanche 25 avril
2027** (le dernier dimanche d'avril), marquée « à confirmer » à l'écran. Quand la date
officielle sera publiée, la changer **décale le plan** : les semaines déjà passées restent
telles qu'elles ont été vécues, seules les semaines à venir se recalent.

**Un plan long, en deux temps.** De mi-octobre à fin avril, il y a environ vingt-huit semaines,
plus que les seize à vingt d'un plan marathon courant. Le plan commence donc par une **phase de
base** (volume qui monte doucement, uniquement en endurance), puis un **bloc spécifique** de
dix-huit semaines vers le marathon (sortie longue qui monte jusqu'à 30-32 km, séances à allure
marathon, seuil), puis l'affûtage. Les longueurs exactes seront fixées et testées à
l'étape 2.

**Un plan par semaine, pas par jour.** Sans jours fixes, chaque semaine liste **ses 3 ou 4
séances**, dans un ordre conseillé (jamais deux séances dures d'affilée, la sortie longue en
fin de semaine) mais libre. Atlas propose **la séance suivante** ; une sortie faite se rattache
à la séance de la semaine qui lui ressemble le plus (sorte, distance), et Jules peut corriger.
Le modèle de §7 change : une séance appartient à une **semaine** du plan, son jour est
facultatif.

**La fréquence cardiaque, au premier plan** (§1 disait « sans zones » : c'est corrigé) :
- **la FC moyenne et maximale de chaque sortie**, rangées ;
- **cinq zones**, calculées par la méthode de Karvonen (réserve cardiaque) depuis la FC
  maximale et la FC de repos, toutes deux réglables ; la FC maximale est proposée d'après la
  plus haute observée dans l'historique, sans jamais remplacer une valeur saisie ;
- **des consignes en zones** : « footing en zone 2 » plutôt qu'une allure seule, quand la FC
  est connue ;
- **un indicateur d'endurance** : l'allure moyenne des footings faits en zone 2, semaine après
  semaine. Courir plus vite au même cœur est la progression la plus honnête d'une préparation
  marathon.
Toujours sans conseil de santé : des chiffres et des zones, pas un diagnostic.

**Reprendre l'historique : l'archive de Strava.** Strava fournit gratuitement l'archive de tout
le compte : un fichier `activities.csv` (une ligne par activité) et un dossier des fichiers
d'activité (GPX, FIT ou TCX, souvent compressés en `.gz`). Atlas la lit **dans le navigateur** :
le zip par `fflate` (licence MIT, quelques Ko), le `.gz` par `DecompressionStream`, intégré aux
navigateurs. Seules les courses sont reprises. Les colonnes exactes du CSV (et la présence de
la FC) se vérifient sur l'archive réelle de Jules à l'étape 3.

**Le temps de référence vient de l'historique** : les meilleurs efforts récents sur 5 km,
10 km ou semi, calculés depuis les sorties reprises, proposent les allures du plan et une
première prédiction pour Annecy. Jules peut les corriger.

### Découpage révisé (7 étapes)

1. **Le module existe** : tables, contrat et ses deux implémentations, module signet.
2. **Les règles, testées avant tout écran** : allures, semaines, zones de FC, records et
   meilleurs efforts, Riegel, **générateur du plan marathon**, lecture de l'archive Strava, du
   GPX, du TCX et du FIT.
3. **L'historique et la V1** : reprise de l'archive Strava, journal des sorties, fiche d'une
   sortie, saisie à la main, tableau de bord.
4. **Le plan marathon** : création (course, date provisoire, séances par semaine, temps de
   référence), semaine en cours, séance suivante, sortie ↔ séance, modifier une séance, décaler
   la date.
5. **L'import automatique** : la fonction `sport-import`, le jeton, le raccourci fourni et ses
   instructions, essayé sur l'iPhone de Jules.
6. **La progression** : volume, allure, FC et zones, endurance en zone 2, records, prédiction.
7. **Les liens** : séances dans Calendar, rappel du matin, lien avec Objectifs (service et
   référence de coche côté Objectifs).

---

## 13. Étape 2 : les règles, testées avant tout écran (07/10/2026)

Neuf bibliothèques pures, sans écran, toutes testées :

- **`format.ts`** : « 10,2 km », « 1:05:09 », « 5:30 /km », « 5:20–5:40 /km ».
- **`pace.ts`** : l'allure, toujours calculée ; la **formule de Riegel** ; les **allures
  d'entraînement** tirées d'un temps de référence — footing à l'allure marathon + 45 à 75 s,
  sortie longue + 30 à 60 s, allure marathon à ± 5 s, seuil entre l'allure du 10 km et celle du
  semi, fractionné à l'allure du 5 km. Pour un 10 km en 50 min : allure marathon vers
  5:27 /km, footing 6:12–6:42 /km.
- **`zones.ts`** : les cinq zones de **Karvonen** (50, 60, 70, 80 et 90 % de la réserve
  cardiaque), ou des parts de la FC maximale sans FC de repos ; la FC maximale **proposée**
  d'après la plus haute vue, jamais imposée.
- **`stats.ts`** : volume par semaine, moyenne des quatre semaines pleines (le départ du plan),
  plus longue sortie récente, **records** (sortie entière à 3 % près, ramenée à la distance
  exacte ; ou les kilomètres consécutifs les plus rapides d'une sortie plus longue, quand on a
  les temps au kilomètre), **temps de référence** (le plus long effort récent parmi semi, 10 et
  5 km), **endurance en zone 2**.
- **`track.ts`** : lire un **GPX** et un **TCX** sans `DOMParser`, et en tirer distance
  (haversine, ou la distance du fichier), durée, dénivelé (au-delà de 3 m, sous le bruit de
  l'altimètre), FC moyenne et maximale (un capteur décroché à 0 n'entre pas dans la moyenne),
  **temps au kilomètre** interpolés.
- **`stravaArchive.ts`** : lire `activities.csv` — courses seulement, distance en mètres de la
  seconde colonne « Distance », temps en mouvement plutôt qu'écoulé (l'allure que montre
  Strava), une compétition (« Workout Type » 1) reste une course, une ligne illisible est
  comptée et dite, jamais devinée ; et repérer les **sorties longues** d'un historique.
  **À vérifier sur l'archive réelle de Jules à l'étape 3** : les colonnes ont été écrites
  d'après le format connu de l'export.
- **`plan.ts`** : **le générateur du plan marathon** (ci-dessous), l'ordre d'une semaine, et le
  **rattachement** d'une sortie à sa séance.
- **`validation.ts`**, **`kinds.ts`**.

**Le lecteur CSV de Budget remonte au socle** (`core/lib/csv.ts`) : Sport en a besoin pour
l'archive Strava, et une pièce dont deux modules ont besoin appartient au socle (CLAUDE.md §3).
Budget l'importe désormais de là, ses tests ont suivi.

### Le plan généré pour Annecy

Sur le cas de Jules (début le 12 octobre 2026, course le 25 avril 2027, 4 séances, un 10 km en
50 min, 25 km par semaine aujourd'hui), le plan fait **28 semaines** :

- **Semaines 1 à 10, la base** : footings (dont un avec lignes droites) et sortie longue, de
  25 à 44 km par semaine, sortie longue de 12 à 18 km.
- **Semaines 11 à 25, le bloc spécifique** : seuil et fractionné en alternance, une sortie
  longue sur deux finissant à allure marathon à partir de la 5e semaine du bloc (6 puis jusqu'à
  14 km), volume de 46 à **60 km**, sortie longue jusqu'à **32 km, atteinte une seule fois, la
  semaine 25**.
- **Une semaine allégée sur quatre** (4, 8, 12… 24), un quart de volume en moins.
- **Semaines 26 et 27, l'affûtage** (45 puis 32 km), avec une séance à allure marathon.
- **Semaine 28, la course** : un rappel d'allure, un footing, puis le marathon, le dimanche.

À trois séances, le pic descend à 50 km et la plus longue sortie à 30 km.

Deux défauts trouvés en vérifiant, avant tout écran :
- la première version plafonnait la sortie longue à 32 km **dès la mi-janvier**, et l'y
  gardait neuf semaines : trop de très longues sorties. Volume et sortie longue montent
  désormais pas à pas sur tout le bloc spécifique, le pic arrivant juste avant l'affûtage ;
- la semaine de la course n'était pas remise dans l'ordre conseillé : le rappel d'allure
  tombait juste avant le marathon (trouvé par le test « jamais deux séances dures
  d'affilée »).

**Ce plan est à relire par Jules** avant l'étape 4 : c'est une base raisonnable, construite
sur des règles écrites, pas l'avis d'un entraîneur.

Le lecteur de fichiers **FIT** viendra avec l'étape 3 : il demande une dépendance
(`fit-file-parser`), qu'on ajoutera quand on saura, sur l'archive réelle, si elle contient des
FIT.

1401 → **1446** tests unitaires, **1079/1079** en local et en mode comptes.

---

## 14. Étape 3 : l'historique et la V1 (07/10/2026)

L'écran du module existe : **tableau de bord**, **journal**, **fiche d'une sortie**, **saisie à
la main**, **fréquence cardiaque** et **reprise de l'historique Strava**.

- **Reprendre l'archive** (`ArchiveImport`, `data/readArchive.ts`) : le zip tel que Strava
  l'envoie, ou `activities.csv` seul. Tout se lit **sur l'appareil**. Un **aperçu** dit, avant
  d'écrire, combien de courses seront ajoutées, combien sont déjà là, combien ont leurs temps
  au kilomètre, ce qui est laissé de côté (vélo, marche) et ce qui est illisible. Seuls les
  fichiers des sorties nouvelles sont lus : une seconde reprise est instantanée et n'ajoute
  rien. Les chiffres du CSV (distance, durée) restent ceux de Strava ; le fichier d'une sortie
  apporte ses temps au kilomètre, et la FC ou le dénivelé quand le CSV ne les a pas
  (`lib/archiveImport.ts`, pur et testé).
- **Nouvelle dépendance : `fflate` 0.8.3** (MIT, quelques Ko), pour ouvrir le zip et les
  fichiers `.gz`. Chargée à la demande, à la première reprise. Elle sert aussi aux tests, qui
  fabriquent une vraie archive.
- **Le tableau de bord** (`Dashboard`) : cette semaine (km, sorties, temps), les douze dernières
  semaines en barres, la dernière sortie, les **records** (1, 5, 10 km, semi, marathon ; « dans
  une sortie » quand le record vient des temps au kilomètre d'une sortie plus longue), une
  **prédiction au marathon** d'après le meilleur effort récent, dite comme une estimation, et
  la **fréquence cardiaque** (`HeartRateCard`) : FC max et de repos, la plus haute FC vue
  proposée d'un toucher, les cinq zones de Karvonen. La FC se règle dans l'écran plutôt que
  dans le panneau commun : c'est là qu'on en voit l'effet.
- **Le journal** (`Journal`) : par mois, du plus récent, avec le total du mois ; chaque ligne
  dit le jour, le titre, la distance, la durée, l'allure et la FC moyenne. Un titre qui répète
  la sorte (« Footing », comme Strava nomme souvent ses activités) ne reçoit pas en plus
  l'étiquette « Footing ».
- **La fiche** (`RunSheet`) : distance, durée, allure, FC moyenne et sa zone, FC max, dénivelé,
  ressenti, note, et les **temps au kilomètre** en barres, le plus rapide en évidence.
- **La saisie** (`RunEditor`, `lib/runForm.ts`) : « 10,2 » km, « 52:30 », « 1:05:09 », « 45 »
  ou « 1 h 05 » ; sorte, ressenti, FC, dénivelé, titre, note. Corriger une sortie importée
  (sa sorte, son ressenti) passe par la même fenêtre.

Défauts trouvés sur captures, pas par les tests : la ligne de la dernière sortie débordait de
son panneau étroit (les chiffres recouvraient le titre), elle prend désormais toute la
largeur ; « Footing » s'affichait deux fois ; la prédiction finissait par un double point.

**Reste à vérifier sur l'archive réelle de Jules** : les colonnes de `activities.csv`, la
présence de la FC, et la forme des fichiers d'activité (des FIT ne seraient pas encore lus :
la sortie est reprise, sans ses temps au kilomètre, et l'aperçu le dit).

1446 → **1456** tests unitaires ; la suite de Sport passe de 5 vérifications du signet à 28 sur
le vrai parcours (dont un vrai zip déposé, et la même archive reprise deux fois) ;
**1105/1105** en local et en mode comptes.

## 15. Étape 4 : le plan marathon (07/10/2026)

Le cœur du module, demandé par Jules : « le module doit me permettre de créer un plan pour
réussir mon marathon ».

- **Créer le plan** (`PlanCreator`) : la course (« Marathon d’Annecy », 25 avril 2027 proposé,
  « à confirmer » tant que la case « date officielle » n'est pas cochée), le début du plan, 3
  ou 4 séances par semaine, un **temps de référence** proposé d'après le meilleur effort récent
  (5 km, 10 km ou semi, corrigible) et un temps espéré facultatif. L'écran rappelle d'où part
  le plan (moyenne des quatre dernières semaines, plus longue sortie récente) et montre un
  **aperçu avant d'enregistrer** : nombre de semaines et phases, pic de kilomètres, plus longue
  sortie longue, prédiction de Riegel. Sans temps de référence, les séances se règlent en
  zones cardiaques.
- **Le plan** (`PlanView`) : la course, le compte à rebours (J-200), la **semaine en cours**
  (phase, km courus sur km prévus, ses séances), puis les autres semaines repliées, la
  suivante ouverte. Chaque séance dit sa distance, ses allures (« 6:10–6:40 /km »), sa zone et
  sa consigne ; la prochaine à faire porte « prochaine ».
- **Les sorties se rattachent toutes seules** (`lib/planView.ts`, `assignRuns`) : une sortie
  choisie à la main pour une séance d'abord, puis chaque sortie, dans l'ordre, sur la séance
  de sa semaine qui lui ressemble le plus (`matchSession`). Une séance est « faite », « à
  faire », « manquée » (semaine passée) ou « à venir ». La fiche d'une sortie propose sa
  séance du plan (« Automatique (…) » ou une autre de la semaine).
- **Modifier une séance** (`SessionEditor`) : titre, sorte, distance, allures (« 5:20 »,
  `parsePace`), zone, jour, consigne, ou la retirer. Des allures à l'envers sont refusées.
- **Changer la date** (`RaceDateEditor`, `reschedule`) : la date confirmée ou repoussée, le
  plan **se recalcule à partir de la semaine en cours** ; les semaines passées et leurs
  sorties restent telles quelles. Les nouvelles séances sont ajoutées **avant** de retirer
  les anciennes (`deleteSessions`, au contrat et dans ses deux implémentations) : une coupure
  laisse au pire des séances en double, jamais un plan vide.
- **Le tableau de bord** commence par le plan (compte à rebours, semaine, prochaine séance),
  ou propose de le créer.

`weekPhase` (`lib/plan.ts`) dit la phase d'une semaine pour le générateur comme pour
l'affichage : une seule règle. Aucune migration : les tables de l'étape 1 suffisaient.
Défauts vus sur captures : « 0 m courus » (une distance nulle se dit « 0 km ») et un double
point dans l'aide du temps de référence.

**À relire par Jules** : le plan généré pour sa date et son temps — volumes, sorties
longues, allures — avant de s'y fier.

1456 → **1465** tests unitaires ; suite de Sport 28 → **44** ; **1118/1118** en local et en
mode comptes.

## 16. Étape 5 : l'import automatique (08/10/2026)

- **La fonction `sport-import`** (`supabase/functions/sport-import/`), première fonction d'Atlas
  qui **reçoit** des données de l'extérieur. Elle n'accepte qu'un POST avec un jeton d'import
  (`Authorization: Bearer spt_…`), cherché par son **empreinte SHA-256** : le jeton n'est
  jamais rangé. Corps limité à 64 Ko et 50 séances. `{ "test": true }` vérifie le jeton sans
  rien écrire ; sans jeton, `{ "ping": true }` dit la version. La réponse porte un `message`
  en français que le raccourci affiche (« Sortie ajoutée à Sport : 10,2 km en 52 min. »).
- **Lecture stricte** (`payload.ts`, pur, testé par Vitest comme `moduleReminders.ts`) : une
  séance ou `{ workouts: […] }` (les sept derniers jours) ; distance avec ou sans unité
  (« 10,23 km », « 10230 m », un nombre seul en km jusqu'à 200), durée en « 52:30 », en
  secondes ou « 52,5 min », ou déduite de la fin ; **départ en ISO 8601 avec son décalage**,
  qui dit le jour vécu par l'iPhone — une date sans fuseau est refusée plutôt que rangée au
  mauvais jour près de minuit. Bornes de la base vérifiées avant l'écriture, chaque refus
  dit sa raison. Seule la sortie longue se devine (18 km et plus).
- **Jamais de doublon** : la référence est l'identifiant de Santé s'il est envoyé, sinon le
  départ à la minute (`sante:…`) ; et une séance déjà dans Sport par un autre chemin (même
  départ à dix minutes près, distance à 10 % près, `sameRun`) n'est pas ajoutée. **Le même
  critère vaut dans l'autre sens** : l'archive Strava ne reprend plus une sortie déjà venue du
  raccourci ou notée à la main. Le critère vit à deux endroits (fonction et app), un test
  vérifie qu'ils s'accordent.
- **Dans Sport** : « ⌚ Apple Watch » (et « Relier l'Apple Watch » sur l'écran vide) ouvre
  `ShortcutSetup` — créer un jeton (tiré sur l'appareil, `lib/importToken.ts`, montré une
  seule fois, avec « Copier » et « Essayer »), la liste des jetons (créé le, servi le,
  « Révoquer »), l'adresse de la fonction, et le raccourci à construire en cinq actions. Sans
  compte, la fenêtre dit qu'il en faut un : aucun jeton ne se crée pour rien.

Aucune migration : `sport_import_tokens` existe depuis l'étape 1.

**À faire par Jules** : déployer la fonction (`supabase functions deploy sport-import
--no-verify-jwt`), créer un jeton, construire le raccourci et faire une vraie course. **Ce que
Santé expose à Raccourcis n'a pas pu être vérifié d'ici** : si l'action « Rechercher des
échantillons de santé » n'offre pas les entraînements ou leur distance, la notification le
dira (« Refusée : distance manquante ») — à me rapporter, la fonction s'adaptera.

1465 → **1482** tests unitaires ; suite de Sport 44 → **46** ; **1120/1120** en local et en
mode comptes.
