# Palier — Benchmark gamification & feuille de route

*Étude des apps qui réussissent à rendre le suivi d'objectifs addictif, et ce qu'on en retient
pour Palier. Juillet 2026.*

---

## 1. Ce que font les meilleurs

### Duolingo — la machine à rétention (churn passé de 47 % à 28 %)

- **Streak quotidien** : compteur de jours consécutifs, remis à zéro si on rate un jour.
  Exploite l'aversion à la perte : à 180 jours, on ne joue plus pour atteindre 181, on joue
  pour ne pas perdre 180.
- **Streak Freeze** : un joker qui protège le streak un jour d'absence. +48 % de durée de
  streak en moyenne chez ceux qui en ont. La leçon : **le pardon retient mieux que la
  punition**.
- **Succès en deux familles** : records personnels atteignables dès le jour 1 (rétention
  33 % vs 20 % chez ceux qui n'en débloquent pas) et médailles rares de long terme
  (rétention jusqu'à 74 % sur les plus difficiles).
- **Ligues hebdomadaires** : ~30 joueurs par poule, promotion/relégation. Poule petite =
  victoire atteignable.
- **Feedback immédiat** : la récompense s'affiche avant même la fermeture de l'écran de
  leçon.
- **Streak entre amis** : le compteur n'avance que si les deux pratiquent le même jour —
  personne ne veut être celui qui casse le streak.

### Habitica — le RPG complet (et ses excès)

- Avatar, XP, or, mana, équipement, familiers, classes, quêtes de groupe où les tâches
  ratées d'un membre blessent toute l'équipe.
- **Contre-exemple à retenir** : rater ses tâches fait perdre des PV, mourir fait perdre un
  niveau et de l'équipement. Ce système punitif épuise les utilisateurs — c'est la critique
  n° 1 de l'app. Palier a déjà le bon instinct (le rang d'un objectif ne redescend jamais).

### Finch — l'attachement émotionnel (30 M$ ARR sans pub)

- Un **compagnon** (oiseau) grandit grâce à tes actions de soin de toi. On ne progresse pas
  pour soi, on progresse *pour lui* — la culpabilité devient de la tendresse.
- **Boucle d'aventure** : tes tâches donnent de l'énergie → l'oiseau part en aventure →
  tu reviens voir ce qu'il a trouvé. Fenêtres de retour organiques, sans notification
  harcelante.
- **Widget vivant** sur l'écran d'accueil : l'app existe même fermée.
- Ton bienveillant, jamais punitif : rien ne se perd quand on s'absente.

### Strava — le social qui fait courir

- **Kudos** : approbation sociale en un geste, zéro friction.
- **Segments & classements** entre amis : la comparaison avec des pairs proches motive plus
  que le classement mondial.
- Le simple fait de savoir que les autres *verront* l'activité pousse à la faire.

### League of Legends — la référence assumée de Palier

- **LP (League Points)** : entre deux rangs, chaque partie fait gagner des points visibles.
  La progression est continue, pas seulement par sauts de rang.
- **Cérémonie de promotion** : plein écran, emblème animé, son. Monter de rang est un
  *événement*, pas une ligne de log.
- **Saisons** : remise à zéro périodique + récompenses de fin de saison (skin, bordure
  d'invocateur) qui prouvent le rang atteint. Le "peak rank" reste dans l'historique.
- **Bordures et emblèmes de profil** : le rang est une identité qu'on affiche.

---

## 2. Les principes transverses

1. **Feedback immédiat et "juteux"** — chaque action méritante déclenche une réponse
   sensorielle : animation avec anticipation et rebond, particules, son court, vibration
   sur mobile. C'est le "game juice" des jeux vidéo, entièrement transposable au web.
2. **Aversion à la perte, mais avec pardon** — streaks oui, punition non. Toujours un
   filet de sécurité (gel, grâce, récupération).
3. **Victoires dès le premier jour** — un nouvel utilisateur doit débloquer quelque chose
   dans sa première session.
4. **Progression visible entre les jalons** — ne jamais laisser l'utilisateur entre deux
   paliers sans rien à gagner (→ LP).
5. **Le social en petit comité** — 3 amis motivent plus qu'un classement mondial.
6. **Rythmes emboîtés** — quotidien (streak), hebdomadaire (ligue/défi), trimestriel
   (saison). Chaque horizon a sa récompense.
7. **L'identité avant les points** — badge de profil, historique, titre : on ne collectionne
   pas des chiffres, on construit qui on est.

---

## 3. Backlog priorisé pour Palier

### P0 — La satisfaction immédiate (le cœur du problème actuel)

| # | Fonctionnalité | Détail |
|---|---|---|
| 1 | **Cérémonie de validation de palier** | Plein écran : l'emblème du rang se forge sous les yeux (animation ~2 s), particules aux couleurs du rang, son optionnel, vibration mobile. Cocher un palier doit être le meilleur moment de la journée. |
| 2 | **Cérémonie de montée de rang de profil** | Encore plus grandiose : ancienne → nouvelle bordure, "Tu es maintenant OR". Partageable en image. |
| 3 | **Game juice généralisé** | Micro-animations sur chaque interaction : case qui rebondit, barre qui se remplit avec easing, compteurs qui défilent. Bibliothèque type canvas-confetti + spring animations. |
| 4 | **PP — Points de Palier** | Progression continue entre paliers : chaque action quotidienne (check-in, note, sous-tâche) rapporte des PP visibles sur une barre vers le prochain palier. On ouvre l'app même les jours sans grand accomplissement. |

### P1 — Les raisons de revenir demain

| # | Fonctionnalité | Détail |
|---|---|---|
| 5 | **Streak avec gel** | Compteur de jours actifs consécutifs (toute action compte). 1 gel gagné par semaine complétée, stockables ×3. Jamais de perte rétroactive. |
| 6 | **Check-in quotidien** | "Qu'as-tu fait aujourd'hui pour tes objectifs ?" — une action en un geste par objectif, qui nourrit PP + streak + historique. C'est le pont entre l'objectif long terme et le quotidien. |
| 7 | **Succès / trophées** | Deux familles à la Duolingo : immédiats ("Premier palier validé", "3 objectifs créés") et rares ("100 jours de streak", "Premier Challenger"). |
| 8 | **Récap hebdomadaire** | Chaque lundi : PP gagnés, paliers validés, streak, comparaison avec la semaine passée. Par mail ou in-app. |

### P2 — Le social (l'arme de rétention ultime, déjà permise par Supabase)

| # | Fonctionnalité | Détail |
|---|---|---|
| 9 | **Profil public & amis** | Pseudo + avatar + bordure de rang. On ajoute des amis, on voit leurs rangs et leurs validations récentes (jamais le détail de leurs objectifs — pudeur par défaut). |
| 10 | **Kudos** | "GG" en un tap sur la validation d'un ami. Notification de réception = dopamine gratuite pour les deux. |
| 11 | **Duo** | Un objectif lié entre deux amis (à la friend streak) : le streak du duo n'avance que si les deux font leur check-in. |

### P3 — Le long terme

| # | Fonctionnalité | Détail |
|---|---|---|
| 12 | **Saisons trimestrielles** | Fin de saison : récap animé façon "Wrapped" (rang atteint, plus long streak, palier le plus dur), récompense cosmétique exclusive (bordure de saison), et le peak rank entre dans l'historique du profil. Pas de reset des objectifs — seulement un nouveau chapitre. |
| 13 | **PWA installable** | Icône sur l'écran d'accueil, plein écran, notifications push (rappel de check-in doux, kudos reçus). |
| 14 | **Cosmétiques débloquables** | Thèmes d'interface, styles d'emblèmes, avatars — achetés avec les PP excédentaires. Boucle d'économie sans argent réel. |

---

## 4. Direction originale proposée : « ta carrière, pas ta to-do list »

Toutes les apps du marché gamifient **l'habitude** (le quotidien qui se répète). Aucune ne
gamifie **la carrière** — la trajectoire longue d'une vie d'objectifs. C'est exactement le
territoire naturel de Palier, et l'esthétique esport est le véhicule parfait :

- **Le langage** : on ne "complète pas des tâches", on *grind*, on *rank up*, on fait sa
  *placement season*. L'app parle comme un jeu compétitif — mais où le seul adversaire est
  la version de soi d'hier.
- **La carrière** : un écran "Carrière" retrace tout — saisons passées, peak ranks,
  trophées, courbe de progression. Dans 2 ans, ouvrir Palier devra faire le même effet que
  relire son historique ranked : *voilà d'où je viens*.
- **Le récap de saison partageable** : l'image de fin de saison (rang, streak, stats) est
  le vecteur de croissance organique — c'est le "Spotify Wrapped" des objectifs de vie,
  fait pour être posté.
- **Le duo comme cœur social** : pas de classement mondial démotivant. Palier se joue
  seul ou en duo — l'ami est un coéquipier, jamais un rival.

**Un garde-fou pour finir** : le rang ne descend jamais, l'absence ne détruit rien, le ton
célèbre et ne culpabilise pas. C'est la leçon croisée de Finch (le pardon) et d'Habitica
(la punition qui fait fuir) — et c'est ce qui différenciera Palier d'un simple clone de
Duolingo.

---

## Ordre de construction suggéré

1. **Sprint 1 (P0)** : cérémonies + game juice + PP. L'app devient *satisfaisante*.
2. **Sprint 2 (P1)** : check-in + streak + succès. L'app devient *quotidienne*.
3. **Sprint 3 (P2)** : profils, amis, kudos, duo. L'app devient *partageable*.
4. **Sprint 4 (P3)** : saisons + PWA + cosmétiques. L'app devient *durable*.

Chaque sprint est déployable seul — l'app reste en ligne et fonctionnelle en permanence.
