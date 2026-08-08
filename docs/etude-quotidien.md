# Zénith — refonte de la couche quotidienne

*Étude et proposition. Août 2026.*

---

## 1. Le diagnostic

La boucle longue de Zénith (objectif → paliers → rangs → carrière) est solide et
originale. La boucle courte, elle, tient en une ligne de puces qu'on tapote. Six
défauts, tous structurels :

**Il n'y a pas de rituel.** Une séance Duolingo a un début, un milieu (la barre qui
avance) et une **fin** (l'écran de récapitulatif). Zénith n'a qu'un basculement
d'état : on tape, la puce devient verte, et… rien ne se conclut. Or c'est la
conclusion qui procure la satisfaction, pas le geste.

**Rien ne dit ce qu'est « assez » pour aujourd'hui.** Avec trois objectifs, trois
puces vertes — est-ce bien ? beaucoup ? le minimum ? Personne ne sait. Duolingo
répond à cette question par un objectif quotidien chiffré, choisi dès
l'inscription : un engagement pris avec soi-même, « spécifique et actionnable ».

**Aucune notion d'intensité.** Dix minutes de marche et vingt kilomètres de course
produisent exactement le même tap et les mêmes 10 PP. L'effort n'existe pas dans le
modèle.

**Le binaire tue les mauvais jours.** La recherche sur les traqueurs d'habitudes est
formelle : ce qui fait abandonner, c'est *l'effet « et puis merde »* — un jour raté
produit « de toute façon j'ai déjà échoué », le lendemain est sauté, le surlendemain
l'app n'est plus ouverte. L'antidote connu est la **version minimale** : chaque
action doit avoir une variante faisable dans son pire jour. Zénith n'en a aucune.

**Le streak est un chiffre passif.** Il vit dans une ligne de statistiques, à côté du
nombre d'objectifs. Chez Duolingo la flamme est un personnage : elle grossit, elle
change d'apparence, elle a ses cérémonies à 7, 30, 100 et 365 jours — le simple fait
de refaire l'animation du 7ᵉ jour a rapporté **+1,7 % de rétention**.

**Une fois les puces vertes, l'app n'a plus rien à offrir.** Aucune raison de rouvrir
avant demain.

---

## 2. Ce que fait Duolingo, et ce qu'on en retient

| Mécanique | Comment ça marche | Ce qu'on prend |
| --- | --- | --- |
| **Objectif quotidien** | Cible d'XP choisie à l'inscription (4 niveaux), anneau qui se remplit | ✅ tel quel — c'est la pièce manquante n° 1 |
| **Séance** | Début / barre de progression / écran de fin qui égrène les gains | ✅ adapté en « séance du jour » |
| **Quêtes du jour** | 3 défis renouvelés toutes les 24 h, coffre à la clé | ✅ version simplifiée, sans monnaie |
| **Streak intégré à la boucle** | Le streak s'incrémente *dans* l'écran de fin, pas dans un coin | ✅ capital — « l'entretien devient automatique plutôt qu'un effort » |
| **Gels silencieux** | Se déclenchent tout seuls, découverts le lendemain via un flocon | ✅ on a les gels, il leur manque le calendrier qui les montre |
| **Paliers de streak** | 7 / 30 / 100 / 365, animations dédiées, cartes partageables | ✅ (les cartes ont fait ×5–10 sur le partage organique) |
| **Streak parfait** | Halo doré pour qui n'a jamais consommé de gel | ✅ jolie hiérarchie, gratuite à implémenter |
| **Streak entre amis** | +22 % de complétion quotidienne | ⏸ pour le sprint social |
| **Cœurs / vies perdues** | Punition en cas d'erreur | ❌ jamais — c'est ce qui fait fuir d'Habitica |
| **Ligues** | Classement hebdo entre 30 joueurs | ⏸ sans utilisateurs, une ligue vide déprime |

---

## 3. La proposition : « la séance du jour »

Trois couches qui s'empilent, de la plus structurante à la plus visible.

### Couche 1 — Les actions : donner un vocabulaire au quotidien

Chaque objectif porte désormais des **actions** : les petites choses concrètes qu'on
fait pour le faire avancer.

```
🏃 Courir un semi-marathon
   ├─ Sortie course        15 PP   · version minimale : 10 min de marche (5 PP)
   ├─ Renforcement         10 PP
   └─ Étirements            5 PP
```

Trois principes, chacun corrigeant une erreur classique :

- **Zéro configuration imposée.** Les actions sont **proposées automatiquement** à la
  création de l'objectif (déduites du thème et des paliers), modifiables ensuite. On
  ne demande jamais à quelqu'un de remplir un formulaire avant d'avoir sa première
  victoire.
- **Chaque action a sa version minimale.** C'est *la* leçon de la recherche sur les
  habitudes : la variante « pire jour » garantit que le deuxième jour manqué
  n'arrive jamais. Elle rapporte moins, mais elle compte — et elle sauve le streak.
- **Aucun calendrier, aucune fréquence à respecter.** Pas de grille « 3× par semaine »
  avec ses cases vides accusatrices. Les actions sont un **menu**, pas un contrat :
  on prend ce qu'on a fait. C'est ce qui empêche Zénith de devenir une machine à
  culpabiliser.

### Couche 2 — L'objectif du jour : répondre à « ai-je fini ? »

Une cible quotidienne en PP, choisie à l'inscription et modifiable :

| Niveau | Cible | Ce que ça représente |
| --- | --- | --- |
| Tranquille | 20 PP | une action, ou deux versions minimales |
| Régulier | 40 PP | deux à trois actions |
| Sérieux | 70 PP | une vraie session quotidienne |
| Intense | 120 PP | plusieurs objectifs travaillés chaque jour |

Elle s'affiche en **grand anneau** sur l'accueil — le héros visuel de la page. Il se
remplit à mesure qu'on agit. Quand il se boucle : **écran plein de célébration**,
c'est là que le streak s'incrémente. Au-delà, le dépassement continue de compter
(« +35 PP au-delà de l'objectif ») sans jamais devenir une nouvelle exigence.

Un palier validé rapporte ses 25 à 250 PP et fait donc exploser l'objectif du jour —
c'est voulu : un jour de palier *doit* être un grand jour.

### Couche 3 — La séance : le rituel qui se conclut

Un bouton **« Commencer ma séance »** ouvre un parcours guidé :

1. **Une carte par objectif**, l'une après l'autre. On coche les actions faites, on
   ajoute la note si on veut, on passe à la suivante.
2. Une barre de progression en haut, comme dans une leçon.
3. **L'écran de fin** — le morceau qui manque aujourd'hui : les PP s'égrènent un par
   un en comptant, l'anneau se remplit sous les yeux, la flamme du streak grandit,
   les trophées débloqués tombent en cascade.

C'est cette conclusion qui transforme trois taps dispersés en un moment. Et c'est
là — dans l'écran de fin, pas dans un coin de l'interface — que le streak monte.

### En complément

**Les quêtes du jour** — trois missions générées automatiquement chaque nuit, aucune
configuration : « travaille 2 objectifs différents », « ajoute une note à un
check-in », « atteins ton objectif du jour ». Elles apportent la variété et une
raison de rouvrir. Récompense : des PP bonus, pas une monnaie de plus.

**La flamme devient un personnage** — grande, animée, au centre de l'accueil. Elle
change d'apparence aux paliers (7 / 30 / 100 / 365 jours), chacun avec sa cérémonie
et sa carte partageable. Un **calendrier du mois** montre les jours pleins, les jours
en version minimale (ambre) et les jours couverts par un gel ❄ — la vue « jardin »
plutôt que la chaîne brisée.

**Le streak sert enfin à quelque chose** — il applique un multiplicateur sur les PP
gagnés : ×1,1 à partir de 7 jours, ×1,25 à 30, ×1,5 à 100. Ça répond du même coup à
ton interrogation de la dernière fois sur le sens des PP : ils deviennent la monnaie
d'un système où la régularité paie mécaniquement, pas seulement moralement.

---

## 4. Comment les objectifs restent le but final

Le risque de cette refonte serait de transformer Zénith en traqueur d'habitudes et de
noyer les paliers. Trois garde-fous :

- **Toute action appartient à un objectif.** Il n'y a pas d'habitude flottante ; le
  quotidien nourrit toujours une ascension.
- **L'accueil montre les deux échelles** : au premier plan l'anneau du jour, juste
  en dessous « ce que ça construit » — le prochain palier de chaque objectif, avec
  sa distance.
- **La hiérarchie des célébrations reste intacte.** Un check-in fait un bruit discret.
  Boucler sa journée déclenche un écran. Valider un palier déclenche la grande
  cérémonie. Monter de rang reste le sommet. Le quotidien est la route, les paliers
  sont les cols.

---

## 5. Ce qu'on ne fera pas

- **Pas de cœurs ni de vies.** Perdre quelque chose en cas d'échec est le mécanisme
  qui vide Habitica de ses utilisateurs.
- **Pas de PP retirés.** Le rang ne redescend jamais, le score non plus.
- **Pas de grille de fréquence obligatoire.** Les cases vides d'un calendrier « 3×
  par semaine » sont un tribunal.
- **Pas de ligues tant qu'il n'y a personne.** Une ligue à un joueur est plus triste
  qu'absente.

---

## 6. Plan de réalisation

| Sprint | Contenu | Effet |
| --- | --- | --- |
| **A — Le socle** | Actions par objectif (auto-proposées, versions minimales), objectif du jour + anneau animé, écran de fin de journée | Le quotidien a une cible, une texture et une conclusion |
| **B — Le rituel** | Parcours « séance du jour » guidé, écran de récapitulatif animé, quêtes du jour | Le quotidien devient un moment, pas une case à cocher |
| **C — La flamme** | Flamme héroïque, paliers de streak avec cérémonies, calendrier mensuel, multiplicateur, cartes partageables | La régularité devient une identité, et elle paie |

Le sprint A change déjà tout : sans lui les deux autres n'ont rien à animer. Chaque
sprint est déployable seul, l'app reste en ligne en permanence.

### Migration

Les check-ins existants deviennent des actions génériques (« Séance ») avec leurs
10 PP — aucun historique perdu, aucune courbe cassée, aucun trophée reperdu.

---

## 7. Le geste ponctuel — ce qui n'entre pas dans une case à cocher

*Ajouté après un retour de Jules : « j'ai regardé un tuto YouTube sur comment tenir
un budget, c'est une action liée à mon objectif que j'aimerais noter dans l'app,
mais c'est pas quelque chose que je vais refaire régulièrement. »*

### Le trou

L'app ne connaissait qu'une seule forme de réalisation : **cocher une action**. Or
une action est une promesse de répétition — elle revient tous les soirs, elle
nourrit un palier, elle finit par mesurer une régularité. Beaucoup de vrais pas
vers un objectif ne sont pas répétables : ouvrir un compte d'épargne, regarder un
tuto, acheter les chaussures, prendre le rendez-vous. Les créer comme actions
polluerait la liste du lendemain d'une case qu'on ne recochera jamais — et une
liste où traînent des cases mortes est une liste qu'on cesse de lire.

### La forme retenue

Une **réalisation sans action**, qui porte son propre titre. Techniquement :
`checkin.actionId = null` et `checkin.title = "…"`. Aucun nouveau modèle de
données, aucune nouvelle typologie d'objectif, une seule colonne ajoutée.

Trois règles l'empêchent de devenir un déversoir :

1. **Il n'apparaît jamais comme une case à cocher le lendemain.** Il n'a pas
   d'action derrière : rien à re-proposer. Il vit sur sa journée et il y reste.
2. **Il ne nourrit aucun palier comptable.** `feedingCheckins` l'écarte avant même
   de regarder les sources. Sinon « 30 jours sans écran » se validerait en notant
   trente fois « j'y ai pensé », et le rang que ce palier donne ne mesurerait plus
   rien.
3. **PP fixes et modestes** (`ONE_OFF_PP = 10`, contre 15 pour un vrai effort).
   On ne choisit pas soi-même combien un geste rapporte — c'est la porte ouverte à
   l'inflation.

Ce qu'il **fait** en revanche, et c'est tout l'intérêt : il compte pour la journée
(anneau, streak global, streak de l'objectif) et il remplit sa case dans la grille.
Regarder un tuto de budget un mardi soir *est* une journée où on s'est occupé de
son objectif. Le nier reviendrait à dire que seule la répétition compte.

### Dans l'interface

- Une pastille `+ Autre chose` en fin de liste, en pointillés et sans PP annoncés :
  une porte, pas une tâche.
- Une barre de saisie en ligne, 80 caractères, Entrée pour valider, Échap pour
  refermer sans rien écrire.
- La pastille du geste est **verte mais pointillée**, préfixée `✦`, marquée
  « noté » et non « fait » — rien n'a été coché, et un ✓ laisserait croire à une
  case de plus. Elle n'est pas barrée pour la même raison.
- Re-cliquer annule : la seule sortie de secours d'une faute de frappe.
- Dans le journal, l'entrée porte le titre du geste et l'étiquette
  « geste ponctuel ». Six mois plus tard, « Check-in » n'aurait rien dit.
- Dans la grille d'habitudes, le détail du jour l'annonce `✦ Tuto sur la gestion
  de budget`. En revanche il **disparaît dès qu'on filtre sur une action** : il
  n'appartient à aucune, et le montrer sous le filtre « Course » ferait croire
  qu'on a couru ce jour-là.

### Hors ligne

La file d'attente le connaît, avec une exception : le dédoublonnage habituel
(« deux fois la même action le même jour ») ne s'applique pas. Deux gestes
ponctuels le même jour sont deux choses différentes ; les confondre en effacerait
un, ce qui est exactement le bug impardonnable d'un traqueur. Ils se reconnaissent
au couple (titre, jour) au moment de la reprise.
