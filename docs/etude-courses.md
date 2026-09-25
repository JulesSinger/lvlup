# Courses — étude du cinquième module

*Étude de conception, écrite avant le code — même exercice que `docs/etude-nutrition.md`.
Objectif : savoir ce que fait le marché, ce qu'Atlas permet de construire sous sa contrainte
« gratuit à vie », et surtout comment se relier — ou non — à Astra, avant d'écrire une ligne.
Les décisions qui reviennent à Jules sont regroupées en fin de document (§11).*

Demande de Jules (25/09/2026) : « faire ma liste de courses, pouvoir choisir si certains
éléments sont répétitifs à chaque course ou d'autres ponctuels, pouvoir dire combien ça m'a
coûté pour chaque course. Peut-être faire un lien avec le module de gestion de budget ? »

---

## 1. Ce qui existe déjà, et sur quoi ce module s'appuie

Comme les quatre modules précédents, celui-ci hérite **gratuitement** du socle : comptes, Row
Level Security, synchronisation entre appareils, réglages, sauvegarde par module, hébergement.
Il suit la mécanique d'ajout de `CLAUDE.md` §3.

**Ce qui tombe à point :**

- **La file hors ligne est commune** depuis l'étape 7 de Cérès (`core/data/outbox.ts`). Cocher
  un article au sous-sol d'un supermarché, sans réseau, est exactement le cas pour lequel elle a
  été remontée au socle : ce module s'y branche sans chantier du socle.
- **Astra connaît déjà les courses.** Sa catégorie de départ « Courses » existe, et son import
  BoursoBank y range automatiquement la rubrique « Vie quotidienne / Alimentation »
  (`modules/budget/lib/boursobankImport.ts`). Autrement dit, **chaque paiement en supermarché
  arrive déjà dans Astra par le relevé bancaire** — c'est le fait qui décide du lien entre les
  deux modules (§7).

**Ce qui ne se réutilise pas** (`conventions.test.ts` interdit tout import entre modules) : le
scanner de code-barres de Cérès, sa recherche d'aliments, la manipulation des montants d'Astra
(`lib/amount.ts`). Ces quelques lignes se recopient ; le scanner, lui, est trop lourd pour être
dupliqué (§8).

**Ce qui est neuf dans le projet :** une liste qui **se remplit toute seule**. Rien dans Atlas
ne remet aujourd'hui un élément en attente parce qu'un cycle s'est terminé — c'est le cœur de
la demande (§3).

---

## 2. Le marché

| Application | Point fort | Modèle (2026) | Ce qu'on en retient |
|---|---|---|---|
| **Listonic** | retient les achats fréquents (« 70 % d'une liste est récurrente »), prix par article et total estimé, tri par rayon | gratuit avec publicité | la récurrence et le tri par rayon sont le standard |
| **Bring!** | une icône par article, listes partagées, import d'ingrédients depuis des sites de recettes | gratuit avec publicité | visuel, facile à adopter |
| **AnyList** | recettes vers liste, partage soigné | 10 à 15 $/an | les recettes, plus tard peut-être |
| **OurGroceries** | la synchro la plus rapide entre membres d'un foyer | gratuit avec pub, ou 20 $ une fois | la liste à deux est *la* fonctionnalité du marché |
| **Rappels d'Apple** (iOS 17 et plus) | une liste « Courses » triée par rayon toute seule, partagée | gratuit, déjà sur l'iPhone | **le vrai concurrent** pour un utilisateur d'iPhone : Atlas doit apporter autre chose |
| **Applis de drive** (Leclerc, Carrefour…) | liste liée au catalogue et aux prix de l'enseigne | gratuites, une seule enseigne | pratique, mais enfermé chez un magasin |

**Ce que tout le monde fait :** partager la liste à plusieurs, retenir les articles fréquents,
trier par rayon.

**Ce que presque personne ne fait :** suivre **ce que chaque course a réellement coûté**.
Listonic estime un total *avant* d'acheter, à partir de prix saisis à la main ; aucune app ne
relie proprement la course faite au paiement. C'est la place qu'Atlas peut occuper, parce qu'il
a déjà Astra à côté.

---

## 3. Le cœur de la demande : habituel ou ponctuel

La mécanique proposée, en une phrase : **une course terminée remet d'elle-même les articles
habituels sur la liste suivante.**

- **Un catalogue** : les articles qu'on achète, chacun marqué **habituel** (lait, pain,
  café — « à chaque course ») ou **ponctuel** (piles, cadeau d'anniversaire).
- **La liste** : ce qu'il faut acheter maintenant, triée par rayon.
- **En magasin**, on coche.
- **« Terminer la course »** demande le montant payé et le magasin, puis :
  - les articles **cochés** sont archivés dans la course (ce qu'on a acheté ce jour-là) ;
  - les **ponctuels** achetés disparaissent de la liste ;
  - les **habituels** achetés y reviennent aussitôt, décochés, pour la prochaine fois ;
  - les articles **non cochés** restent sur la liste (rupture de stock, oubli).

**Variante à trancher (§11) :** un habituel « à chaque course » suffit pour le lait ; il ne
suffit pas pour la lessive, qu'on n'achète qu'une fois sur trois. Deux façons d'aller plus loin :
une fréquence en nombre de courses (« toutes les 3 courses »), ou en jours (« tous les 15
jours »). La V1 peut démarrer avec « à chaque course » seulement, et ajouter la fréquence sans
migration lourde (une colonne).

---

## 4. Le périmètre proposé pour la V1

| Question | Réponse proposée |
|---|---|
| Une liste | **Une seule**, triée par rayon (une par magasin : question §11) |
| Un article | nom, rayon, quantité (texte libre : « 2 », « 1 kg »), note, habituel ou ponctuel |
| Ajouter | champ de saisie avec les articles déjà connus proposés dès la frappe |
| Rayons | une liste fixe (fruits et légumes, crèmerie, boucherie, épicerie, surgelés, boissons, hygiène, entretien…), **devinée d'après le nom** et corrigeable |
| En magasin | cocher et décocher, les cochés descendent en bas de leur rayon |
| Terminer la course | montant, magasin (proposé d'après les précédents), date |
| Historique | la liste des courses faites, avec ce qui a été acheté |
| Chiffres | dépense par mois, panier moyen, par magasin |
| **Hors V1** | partage à deux, prix par article, recettes, lien avec Astra, code-barres |

---

## 5. Le modèle de données

Tables préfixées par le nom technique `courses`, toutes avec `user_id`, leurs quatre politiques
RLS et un index sur `user_id` (`CLAUDE.md` §5).

| Table | Rôle | Colonnes principales |
|---|---|---|
| `courses_items` | le catalogue | nom, rayon (CHECK), `recurring` (habituel), quantité par défaut |
| `courses_list` | ce qui est à acheter maintenant | article, quantité, note, `checked` |
| `courses_trips` | une course faite | jour, magasin, **montant en centimes entiers** (comme Astra, jamais de flottant), note |
| `courses_trip_items` | ce qui a été acheté | nom et quantité **figés** au moment de la course |

- **Figer ce qui a été acheté**, comme les entrées de Cérès : renommer ou supprimer un article
  du catalogue ne réécrit pas l'historique.
- **Les rayons** en tableau TypeScript `as const`, avec un test qui le compare au CHECK de la
  migration (discipline de `TIER_KINDS`, `CLAUDE.md` §5).
- **Le total d'un mois n'est jamais stocké**, toujours recalculé depuis les courses — même
  principe que le total du mois d'Astra.

---

## 6. Les bibliothèques pures, testées avant tout écran

- `lib/aisles.ts` : deviner le rayon d'après le nom (« yaourt » → crèmerie), sans accents ni
  majuscules, et trier la liste par rayon.
- `lib/trip.ts` : **la clôture d'une course** — à partir de la liste et des articles cochés,
  calculer ce qui est archivé, ce qui disparaît, ce qui revient. C'est la règle du §3, et la
  plus importante à tester.
- `lib/stats.ts` : dépense par mois, panier moyen, par magasin.

---

## 7. Le lien avec Astra

C'est la question que pose Jules, et elle a une réponse moins évidente qu'il n'y paraît.

**Option 1 — la course crée une dépense dans Astra. Déconseillée.** L'import du relevé
BoursoBank amène déjà ce même paiement, rangé en « Courses ». Créer une écriture de plus le
ferait **compter deux fois**, et le total du mois d'Astra mentirait. Ce serait aussi un import
direct d'un module vers un autre, interdit par `conventions.test.ts`.

**Option 2 — pas de lien technique. Recommandée pour la V1.** Chaque module garde ce qu'il sait
le mieux :

- Astra reste **la vérité bancaire** : ce qui est sorti du compte, par catégorie ;
- les courses apportent **ce que la banque ignore** : ce qu'on a acheté, le coût de chaque
  course, le panier moyen, la comparaison entre magasins.

Les deux totaux de « Courses » peuvent légitimement différer (une course payée en liquide, un
passage chez le boucher qu'on ne note pas), et c'est acceptable tant que personne ne les
additionne.

**Option 3 — un rapprochement en lecture seule, plus tard.** Dans Astra, une ligne « Courses »
importée afficherait « correspond à la course du 12/09, Carrefour, 23 articles » ; dans
Courses, on lirait « la banque dit 84,20 € ». Aucune écriture croisée, donc aucun double
comptage. Mais un module ne peut pas lire les données d'un autre : il faut **un mécanisme du
socle**, par exemple un champ déclaratif dans `AtlasModule` par lequel un module expose des
données en lecture, que le socle transmet sans en connaître le contenu (le même principe que
`LandingPreview`). C'est un vrai chantier d'architecture, qui servirait à d'autres liens plus
tard (Cérès ↔ Zénith, par exemple). À décider une fois la V1 utilisée.

---

## 8. Ce qui va bloquer, ou coûter

| Obstacle | Gravité | Réponse |
|---|---|---|
| **Le partage à deux** | la première fonctionnalité du marché | Une liste commune à deux comptes demande de revoir le RLS (aujourd'hui, chaque ligne n'appartient qu'à un compte) et de la synchro en direct (Supabase Realtime, compris dans l'offre gratuite). C'est aussi la première fonctionnalité « sociale » d'Atlas, que la règle n°2 de `CLAUDE.md` écarte pour l'instant. Un vrai chantier, à décider (§11) |
| **Le hors-ligne en magasin** | réel | Couvert par la file commune (`core/data/outbox.ts`) : cocher, ajouter, terminer la course survivent à une coupure |
| **Les prix par article** | saisie fastidieuse | Hors V1. Piste gratuite pour plus tard : **Open Prices**, un projet d'Open Food Facts qui recense des prix relevés par ses contributeurs |
| **Le double comptage avec Astra** | piège | Évité en ne créant jamais d'écriture dans Astra (§7) |
| **Le code-barres** | coût | Le scanner de Cérès ne peut pas être importé (règle entre modules). Pour s'en servir ici, il faudrait **le remonter au socle** ; sinon, s'en passer — une liste de courses se tape plus vite qu'elle ne se scanne |
| **La concurrence des Rappels d'Apple** | produit | Sur la liste seule, Atlas ne fera pas mieux qu'une app déjà installée sur l'iPhone. L'intérêt tient au **coût des courses** et, plus tard, au lien avec Astra |

Aucun service payant n'est nécessaire.

---

## 9. Nommer le module — à trancher ensemble

Nom technique proposé : **`courses`** (dossier, tables `courses_*`, classes `.courses-*`).

Pour le nom affiché, dans la famille céleste (Atlas, Zénith, Astra, Orbite, Cérès) :

- **Comète** *(proposition)* — un astre qui **revient périodiquement**, exactement comme les
  articles habituels qui reviennent sur la liste.
- **Pléiades** — un amas d'étoiles, comme une liste d'articles.
- **Luna** — le cycle, la course de la semaine.

---

## 10. Découpage du chantier

| Étape | Contenu | Résultat |
|---|---|---|
| 1 | Migration, contrat et ses deux implémentations, module signet, tests exigés par `conventions.test.ts` | le module existe, vide |
| 2 | Bibliothèques pures : rayons, clôture d'une course, statistiques | la règle est juste |
| 3 | Écran de la liste : ajouter, habituel/ponctuel, rayons, cocher | **la V1 est atteinte** |
| 4 | Terminer la course, historique | on sait ce que coûte une course |
| 5 | Hors-ligne, sur la file du socle | la règle n°3 tient en magasin |
| 6 | Statistiques : par mois, panier moyen, par magasin | on voit l'évolution |
| 7 | Lien avec Astra, si décidé (§7, option 3) | — |

---

## 11. Questions ouvertes à trancher ensemble

*Tranchées depuis : voir §12.*

1. **Le nom** : Comète, Pléiades, Luna, ou autre ?
2. **Partage à deux** : faut-il une liste commune avec quelqu'un d'autre ? (gros chantier, §8)
3. **Lien avec Astra** : aucun pour l'instant (recommandé), ou prévoir le rapprochement en
   lecture seule plus tard ?
4. **Une seule liste, ou une par magasin** ?
5. **Le coût** : le total de la course suffit-il, ou veux-tu aussi le prix de chaque article ?
6. **Hors-ligne** : dans la V1, ou juste après ? (La file existe déjà ; il n'y a que le
   branchement à faire.)
7. **Récurrence** : « à chaque course » suffit, ou faut-il une fréquence (toutes les N courses,
   tous les N jours) ?

---

## 12. Décisions prises avec Jules (25/09/2026)

| Question (§11) | Décision | Conséquence |
|---|---|---|
| 1. Nom | **Comète** | `label: 'Comète'` ; nom technique `courses` |
| 2. Partage à deux | **Non** | le RLS reste « une ligne, un compte », comme partout dans Atlas |
| 3. Lien avec Astra | **Oui** | consigné sous la forme du **rapprochement en lecture seule** (§7, option 3), la seule qui ne compte pas deux fois un paiement déjà importé par la banque — **à confirmer avec Jules avant l'étape qui le construit**. Demande un mécanisme du socle |
| 4. Listes | **Une seule liste**, mais **le magasin de chaque course** | une table des magasins ; chaque course en désigne un |
| 5. Coût | **Le prix de chaque article** | voir ci-dessous : prix par ligne, total proposé, estimation avant d'acheter |
| 6. Hors-ligne | **Pas de mode sans réseau** | l'étape 5 du découpage disparaît. Conséquence assumée : sans réseau, cocher ou terminer une course échoue avec un message, et le formulaire reste rempli. Le branchement sur la file du socle reste possible plus tard, sans migration |
| 7. Récurrence | **Plusieurs options** : à chaque course, toutes les 2, 3, 4… courses | voir ci-dessous |

### Le prix de chaque article

- En magasin ou au retour, chaque ligne cochée peut recevoir **son prix** (celui payé pour la
  quantité achetée, en centimes entiers).
- **Le total de la course est proposé** comme la somme des prix saisis, mais reste modifiable :
  **le ticket fait foi**. Une promotion au total, ou un article oublié, ne doit pas forcer à
  tout ressaisir.
- **Les prix sont figés** dans l'historique (`courses_trip_items`), avec le magasin de la course :
  on en tire l'historique du prix d'un article, **par magasin**, sans table supplémentaire.
- Cela ouvre, sans rien stocker de plus, **l'estimation avant d'acheter** (le total probable de la
  liste, d'après les derniers prix connus dans ce magasin) — la fonctionnalité de Listonic, avec de
  vrais prix plutôt que des prix inventés.

### La récurrence, en nombre de courses

Un article porte une récurrence : **aucune** (ponctuel), **1** (à chaque course), **2**, **3**,
**4**… courses. Les courses sont numérotées dans l'ordre. Un article habituel acheté à la course
n° *k* revient sur la liste pour la course n° *k + N* : à la clôture de la course n° *j*, il y
est remis si `(j + 1) − k ≥ N`. Un habituel pas encore acheté du tout est simplement sur la liste.
Cette règle vit dans `lib/trip.ts`, testée avant tout écran (§6).

### Modèle révisé (remplace §5)

| Table | Rôle | Colonnes principales |
|---|---|---|
| `courses_items` | le catalogue | nom, rayon (CHECK), `recurrence` (entier ≥ 1, ou nul = ponctuel), quantité par défaut, numéro de la dernière course où il a été acheté |
| `courses_stores` | les magasins | nom |
| `courses_list` | la liste en cours | article, quantité, note, `checked`, prix saisi (facultatif) |
| `courses_trips` | une course faite | numéro, jour, magasin, **total en centimes entiers** (celui du ticket) |
| `courses_trip_items` | ce qui a été acheté | nom, quantité, rayon et **prix figés** |

### Découpage révisé (remplace §10)

| Étape | Contenu | Résultat |
|---|---|---|
| 1 ✅ | Migration, contrat et ses deux implémentations, module signet | le module existe, vide — **livré le 25/09/2026**, voir §13 |
| 2 ✅ | Bibliothèques pures : rayons, clôture d'une course et récurrence, prix et estimation, statistiques | la règle est juste — livré le 25/09/2026, voir §14 |
| 3 | Écran de la liste : ajouter, récurrence, rayons, cocher, prix | **la V1 est atteinte** |
| 4 | Terminer la course (magasin, total proposé), historique | on sait ce que coûte une course |
| 5 | Statistiques : par mois, panier moyen, par magasin, prix d'un article dans le temps | on voit l'évolution |
| 6 | Le lien avec Astra : mécanisme du socle, puis rapprochement en lecture seule | — |

---

## 13. Étape 1 : le module existe (25/09/2026)

- **Migration** `supabase/2026-09-25-courses-tables.sql` : les cinq tables du modèle révisé
  (§12), RLS complet, et une **fonction `courses_close_trip`** qui applique la clôture d'une
  course **en une seule transaction**. Terminer une course écrit à cinq endroits (la course, ce
  qui a été acheté, le catalogue, la liste — retirer et remettre) : faites une par une depuis le
  navigateur, ces écritures pourraient s'arrêter au milieu, et une course enregistrée dont la
  liste n'a pas été vidée serait terminée une seconde fois. Avec la fonction, tout passe ou rien
  ne passe. Elle tourne avec les droits de l'appelant (`security invoker`), donc sous le RLS.
  C'est aussi ce qui compense l'absence de mode hors ligne (décision §12) : une coupure ne laisse
  jamais une course à moitié écrite.
- **Numéro de course unique par compte** (`courses_trips_number_key`) : une même clôture envoyée
  deux fois (double clic, réseau qui hésite) est refusée plutôt que de créer deux courses.
- **Le plan de clôture est calculé côté application** (`ClosePlan`, écrit à l'étape 2 par
  `lib/trip.ts`) ; le stockage ne fait que l'appliquer, sans connaître la règle de récurrence —
  même séparation que `reviewCard` d'Orbite ou les valeurs figées de Cérès.
- **Jamais deux fois un article sur la liste** : un habituel à remettre qui y est déjà (pas coché
  cette fois) n'est pas ajouté une seconde fois — dans la fonction SQL comme dans la version
  locale.
- **Contrat** `CoursesStore` et ses deux implémentations, `LocalCourses` (toute la clôture en une
  seule écriture du stockage local, l'équivalent de la transaction) et `SupabaseCourses`
  (clôture par `rpc('courses_close_trip')`, restauration qui reconstitue les liens entre
  tables).
- **Module inscrit au registre**, avec un signet et un aperçu sur la page d'accueil ; rayons en
  tableau `as const`, comparés par un test aux deux contraintes de la migration.

**Migration à appliquer** dans Supabase Studio avant d'utiliser Comète en mode comptes.

---

## 14. Étape 2 : les règles, testées avant tout écran (25/09/2026)

Cinq bibliothèques pures, 47 tests, aucun écran.

- **`lib/trip.ts` — la clôture et la récurrence**, la règle centrale (§3, §12). `isDue` : un
  habituel acheté à la course n° *k* avec une récurrence *N* est dû pour la course n° *k + N* ;
  jamais acheté, il est toujours dû ; un ponctuel ne l'est jamais. `buildClosePlan` calcule tout
  ce que « terminer la course » écrit : lignes cochées archivées avec leurs prix et retirées,
  lignes non cochées laissées, habituels remis s'ils sont dus à la **course suivante**, jamais
  en double. Le total du ticket l'emporte sur la somme des prix. **Une course sans rien de coché
  est refusée** : elle serait vide, et ferait en plus avancer l'horloge de la récurrence pour
  rien. `RECURRENCE_CHOICES` : ponctuel, puis toutes les 1, 2, 3, 4, 6 ou 8 courses.
- **`lib/aisles.ts` — les rayons.** `guessAisle` devine le rayon d'après le nom, sans accents ni
  majuscules, au pluriel comme au singulier, **sur des mots entiers** (« thé » ne reconnaît pas
  « thon ») et **le mot-clé le plus long l'emporte** (« lait de coco » va en épicerie, « eau de
  Javel » en entretien, « légumes surgelés » en surgelés). Ce n'est qu'une proposition, corrigée
  d'un geste. `groupByAisle` range la liste dans l'ordre d'un parcours de magasin : dans un rayon,
  ce qui reste à prendre d'abord, puis ce qui est déjà dans le panier.
- **`lib/prices.ts` — les prix.** Historique d'un article (par magasin), dernier prix connu dans ce
  magasin ou à défaut ailleurs (en le disant), **estimation de la liste** avant d'y aller, qui
  compte à part les articles sans prix connu. Un prix est celui **d'une ligne** — la quantité est
  un texte libre (« 2 », « 1 kg ») qu'on ne sait pas diviser : l'estimation est juste pour les
  habituels, qu'on achète à peu près pareil à chaque fois.
- **`lib/stats.ts` — les chiffres.** Dépense par mois (un mois sans course vaut zéro, il n'est pas
  sauté), panier moyen, par magasin (regroupé par nom figé : un magasin supprimé depuis reste
  compté).
- **`lib/money.ts` — euros et centimes**, sans flottant, recopié de la logique d'Astra plutôt
  qu'importé (règle entre modules).

---

## Sources

- Comparatifs 2026 : [Listonic contre OurGroceries](https://listonic.com/compare-apps/listonic-vs-our-groceries),
  [NerdWallet, meilleures applis de liste de courses](https://www.nerdwallet.com/finance/learn/best-grocery-list-apps),
  [Listonic, Bring!, AnyList et OurGroceries testés](https://smartcartfamily.com/en/blog/grocery-apps-comparison)
- [Fonctionnalités de Listonic](https://listonic.com/fr/fonctionnalites) (articles fréquents,
  prix et total estimé) ; [Listonic contre Bring!](https://listonic.com/comparez-applis/listonic-vs-bring)
- Prix relevés en septembre 2026, susceptibles d'évoluer
