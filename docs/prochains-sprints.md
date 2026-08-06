# Zénith — où en est l'app, et quoi construire ensuite

*Analyse à froid après les sprints 1 et 2, les correctifs terrain et la refonte de la page
d'accueil. Août 2026. Hypothèse de travail retenue : **Zénith est d'abord ton outil
personnel** — ce qui change complètement l'ordre des priorités par rapport au benchmark
initial.*

---

## 1. Ce qui est en place

| Domaine | État |
|---|---|
| Compte & données | Supabase (Postgres + Auth + RLS), multi-appareils, export/import JSON |
| Objectifs | Paliers mesurables, rangs attribués automatiquement, 36 modèles, 8 catégories, archivage |
| Quotidien | Actions par objectif, objectif de PP quotidien, anneau, streak avec gels, notes libres |
| Satisfaction | 5 types de cérémonies, confettis, son, vibration, animation du +PP |
| Long terme | 12 trophées persistants, courbe de PP, historique des paliers, stats hebdo |
| Mobile | PWA installable, service worker, badge d'app, barre de navigation basse, 0 jank mesuré |
| Vitrine | Page d'accueil publique, onboarding en 4 écrans |
| Qualité | 81 vérifications e2e (Playwright) sur le build de production |

C'est une boucle solo complète. Le problème n'est plus « il manque des fonctionnalités » :
il est ailleurs.

---

## 2. Les vraies faiblesses aujourd'hui

### a) Rien ne te ramène

Le seul rappel existant est la **pastille** sur l'icône (`setAppBadge`). Elle ne se voit que
si l'app est installée, et elle ne fait aucun bruit. Un jour chargé = un jour manqué = un gel
consommé sans que tu le saches. Sur trois semaines, c'est le streak qui saute.

C'est le point n° 1, et de loin : tout le reste de l'app ne sert à rien les jours où tu ne
l'ouvres pas.

### b) La saisie est binaire, donc l'historique est pauvre

Une action est **faite ou pas faite**. « Sortie course » vaut 15 PP que tu aies fait 3 km ou
21 km. Conséquences :

- l'historique ne dit rien de réel — dans six mois tu sauras que tu as coché 84 fois, pas que
  tu as couru 620 km ;
- la note libre sert de rustine (« 8 km ce matin ») mais elle n'est ni comptée, ni
  agrégeable, ni comparable ;
- le système récompense **le clic**, pas l'effort. C'est le défaut classique des trackers
  d'habitudes, et il finit par vider les points de leur sens.

### c) Les PP s'accumulent sans jamais servir

Tu l'avais déjà signalé après tes premiers tests, et c'est toujours vrai. Ils remplissent
l'anneau du jour, ils alimentent deux trophées, et c'est tout. Un compteur qui monte sans
contrepartie perd son pouvoir au bout de quelques semaines.

### d) Le long terme est vide

Après six mois d'usage, l'app te montrera : une liste de paliers validés, une courbe de PP,
douze trophées. Il manque exactement ce qui devait être la promesse — **la carrière**. Pas de
peak rank conservé, pas de bilan par objectif, pas de vue « voilà ton année », pas de
saisons. C'est le chapitre le plus prometteur du benchmark et il n'est pas commencé.

### e) Le hors-ligne fait semblant

Le service worker sert bien l'app sans réseau, mais **les écritures partent quand même vers
Supabase**. Coche une action dans le métro : l'interface affiche le +PP (optimiste), l'appel
échoue, et le rafraîchissement suivant efface la coche. Le pire scénario possible pour un
tracker.

### f) Le cœur métier n'a aucun test

`ranks.ts`, `streak.ts`, `progress.ts` sont des fonctions pures qui décident du rang, du
streak et des PP — et il n'existe **aucun test unitaire** dessus. Les 81 vérifications e2e
testent l'écran, pas les cas limites (changement d'heure, trou de 3 jours avec 2 gels, année
bissextile). Un bug qui casse un streak de 100 jours est irrattrapable.

### g) Deux filets de sécurité manquants

- **Pas de « mot de passe oublié »** : si tu perds ton mot de passe, tu perds ton compte.
- **Pas de sauvegarde automatique** : l'export existe, mais il faut y penser.

---

## 3. Ce qu'il ne faut PAS construire maintenant

Puisque l'app est d'abord pour toi, ces chantiers — pourtant en haut du benchmark initial —
descendent tout en bas :

- **Amis, kudos, profil public, duo.** L'onglet « Amis » peut rester grisé. Ces
  fonctionnalités coûtent cher (tables, politiques RLS, flux d'invitation, modération) et ne
  rapportent rien tant que vous êtes deux.
- **Encore des modèles d'objectifs.** 36 suffisent largement pour une personne.
- **Encore des trophées.** 12 non débloqués valent mieux que 30 dilués.
- **Une nouvelle refonte visuelle.** Elle vient d'être faite ; le prochain gain est ailleurs.

---

## 4. Les prochains sprints

### Sprint 3 — « Le geste quotidien » 🔴 le plus rentable

*Objectif : que l'app te chope tous les jours, et qu'elle enregistre ce que tu as vraiment
fait.*

| # | Chantier | Détail | Effort |
|---|---|---|---|
| 1 | **Vrai rappel quotidien** | Notification push à une heure choisie, muette si la journée est déjà bouclée, plus insistante si le streak est en jeu. Techniquement : Supabase Edge Function + VAPID, déclenchée par `pg_cron`. Sur iPhone, exige la PWA installée (iOS ≥ 16.4). | M |
| 2 | **Actions quantifiées** | Une action gagne une unité optionnelle (`km`, `min`, `pages`, `€`). On coche *et* on saisit la valeur en un geste. Les PP peuvent rester fixes — l'important est que la quantité soit stockée. | M |
| 3 | **Hors-ligne fiable** | File d'attente locale des coches, rejouée à la reconnexion. Une action cochée n'est jamais perdue. | M |
| 4 | **Tests du cœur métier** | Vitest sur `ranks`, `streak`, `progress` : trous et gels, changements d'heure, moyenne de rang, PP du jour. | S |
| 5 | **Mot de passe oublié** | Le `resetPasswordForEmail` de Supabase + écran de nouveau mot de passe. | S |

**Pourquoi en premier :** les points 1 et 3 conditionnent tout le reste (une app qu'on
n'ouvre pas et qui perd des coches ne mérite aucune nouvelle fonctionnalité), et le point 2
est le préalable au sprint suivant — sans quantités, la carrière n'a rien à raconter.

---

### Sprint 4 — « La carrière » 🟠 ce qui rend l'app précieuse dans six mois

*Objectif : que rouvrir Zénith dans un an fasse le même effet que relire un historique
ranked.*

| # | Chantier | Détail | Effort |
|---|---|---|---|
| 6 | **Écran Carrière** | Peak rank par objectif (conservé même après archivage), meilleur streak, totaux par unité (« 620 km, 84 sorties »), et une heatmap annuelle façon contributions. | M |
| 7 | **Saisons trimestrielles** | Un chapitre tous les 3 mois. Aucun reset des objectifs : seulement un bilan figé, un peak rank de saison, et une bordure de profil qui en garde la trace. | M |
| 8 | **Rétrospective animée** | À la fin de chaque saison (et le premier lundi de chaque mois, en version courte) : cérémonie plein écran qui déroule tes chiffres. C'est le moment de fierté que l'app n'a pas encore. | M |
| 9 | **Donner un usage aux PP** | Paliers de PP → bordures d'emblème, titres, thèmes. Une boucle d'économie sans argent, qui redonne du sens au compteur. | S |
| 10 | **Date cible & projection** | Un objectif peut viser une date. L'app dit « à ce rythme, tu y es le 14 mars » — la projection est plus motivante qu'une échéance sèche. | S |

---

### Sprint 5 — « Ne pas se lasser » 🟡

*Objectif : tenir au-delà du troisième mois, quand la nouveauté est passée.*

| # | Chantier | Détail | Effort |
|---|---|---|---|
| 11 | **Défis hebdomadaires** | Générés depuis tes propres actions (« 5 sorties cette semaine », « 3 jours sans écran le soir »). Renouvelés chaque lundi, bonus de PP à la clé. La variété sans rien à configurer. | M |
| 12 | **Cérémonies différenciées** | Un palier Challenger ne doit pas se célébrer comme un palier Bronze. Rareté visuelle = rareté ressentie. | S |
| 13 | **Raccourci iOS / widget** | Cocher une action sans ouvrir l'app (Raccourcis Apple vers une URL dédiée). Le geste passe de 4 tapotements à 1. | M |
| 14 | **Thèmes** | Deux ou trois palettes débloquées par les PP. | S |

---

### En continu — dette et hygiène

- **Sauvegarde automatique** hebdomadaire (export JSON déposé côté client, ou envoyé par mail).
- **Suppression de compte** (et c'est aussi ce que le RGPD attend le jour où tu ouvres).
- **`styles.css` : 3 218 lignes** dans un seul fichier — à découper par domaine avant que ça
  devienne ingérable.
- **`App.tsx` : 753 lignes** — extraire la logique de célébration et le calcul de trophées
  dans des hooks dédiés.

---

## 5. Si tu ne devais faire que trois choses

1. **Le rappel quotidien.** Sans lui, rien d'autre ne compte.
2. **La file d'attente hors-ligne.** Perdre une coche est le seul bug impardonnable ici.
3. **Les actions quantifiées.** C'est ce qui transformera l'historique en quelque chose que
   tu auras envie de relire.

Le reste peut attendre. Et le social peut attendre très longtemps.
