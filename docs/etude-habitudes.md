# Les habitudes — étude

*Août 2026. Point de départ : « arrêter de se ronger les ongles », « arrêter de se craquer les
doigts » — ce ne sont pas des objectifs qu'on coche une fois. Faut-il une autre typologie, avec
un autre système de suivi ? Et les actions ne devraient-elles pas devenir ces habitudes ? »*

*Contrainte posée d'entrée, et qui commande tout le reste : **ça doit rester simple.***

---

## 1. Le diagnostic est juste, mais l'entité existe déjà

Tu as raison sur le symptôme. « Arrêter de me ronger les ongles » entré comme objectif donne
quelque chose de bancal : il faut inventer des paliers, la carte annonce « 0/4 paliers » comme
si on n'avait rien fait, et le jour où le dernier palier tombe l'objectif est « accompli » alors
qu'on continuera toute sa vie.

Mais avant de créer une deuxième typologie, il faut regarder ce que Zénith a déjà, parce que la
réponse à ta question — *« est-ce que les actions ne doivent pas devenir ces habitudes ? »* — est
**oui, et elles le sont déjà** :

| Ce qu'une app d'habitudes propose | Ce que Zénith a aujourd'hui |
|---|---|
| Une habitude qu'on coche une fois par jour | Une **action**, unique par jour (contrainte en base) |
| Un historique daté | Chaque **check-in** porte son jour |
| Un streak | `computeStreak`, avec ses gels |
| Une quantité (16 minutes, 8 km) | `unit` + `defaultValue` + `value` (lot 6) |
| « 30 jours sans fumer » | `serie('30 jours sans fumer', 30)` — déjà dans les modèles |
| « 30 jours à 10 000 pas » | `compte('30 jours à 10 000 pas', 30)` |

Une action **est** une habitude. Elle a le bon grain, la bonne fréquence, le bon historique.
Ce n'est pas un modèle de données qui manque.

## 2. Ce qui manque vraiment — trois choses, pas une typologie

### a) La mémoire

C'est le vrai trou, et c'est celui que ta capture d'écran montre. On coche tous les soirs pendant
trois mois et **il n'existe aucun écran où voir ces trois mois**. L'historique est chronologique
et mélange tout ; le compteur d'un palier est une barre qui dit « 47 / 90 » sans rien dire de la
forme du parcours. Or sur une habitude, la forme est l'information : deux trous isolés en juin
n'ont rien à voir avec dix jours d'affilée sautés en juillet, et un compteur les résume
identiquement.

**La grille de petits carrés n'est pas une nouvelle catégorie de fonctionnalité. C'est la mémoire
manquante d'une chose qui existe déjà.**

### b) La fin qui n'en est pas une

Un objectif dont tous les paliers sont validés devient « accompli », sort de « Ce que ça
construit » et se range dans la vitrine. Pour « Courir un marathon », c'est exactement ce qu'on
veut. Pour « Arrêter de me ronger les ongles » à 365 jours, c'est absurde : on n'a pas fini, on
**entretient**. L'app devrait avoir un troisième état entre « en cours » et « accompli ».

### c) La porte d'entrée

Pour suivre une habitude, il faut aujourd'hui : créer un objectif, lui écrire une description,
inventer trois ou quatre paliers, puis renommer les deux actions génériques. Quatre concepts pour
« je veux arrêter de me ronger les ongles ». C'est le vrai coût, et il est à l'entrée.

## 3. Ce que je ne recommande pas : une deuxième typologie

Créer une entité `Habitude` à côté de `Objectif` coûterait, en vrai :

- une deuxième entrée de navigation, un deuxième bouton de création, un deuxième éditeur ;
- un deuxième vocabulaire (une habitude a-t-elle des PP ? un rang ? entre-t-elle dans le rang du
  profil ? nourrit-elle le streak ?) — et chaque réponse est une décision de plus à documenter ;
- une deuxième table, un deuxième chemin de synchronisation, un deuxième chemin hors ligne, un
  deuxième export ;
- et surtout : **le hub devrait afficher deux listes** dans « Aujourd'hui », alors que le geste
  du soir est rigoureusement le même.

Pour un bénéfice que les trois manques ci-dessus obtiennent sans ça. C'est exactement le genre
d'ajout qui fait qu'une app « devient trop complexe ».

## 4. Ce que je recommande : l'habitude est un objectif qui ne se termine pas

Aucun nouveau champ en base. Aucune nouvelle entité. Une habitude est un objectif dont les
paliers se comptent en jours — ce que la grammaire des paliers sait déjà exprimer depuis le
sprint précédent.

Ce qu'on ajoute, c'est ce qui manque :

1. **La grille** sur la carte d'objectif — la mémoire.
2. **L'état « entretien »** — la fin qui n'en est pas une.
3. **Une catégorie « Habitudes »** dans la bibliothèque de modèles — la porte d'entrée, en un
   tap, sans formulaire.
4. **La règle des deux jours, rendue visible** — voir §6.

Le test décisif : après ce sprint, **rien ne change dans le geste quotidien**. Le hub liste les
mêmes pastilles, on coche pareil, le streak marche pareil. Toute la nouveauté est de la
**restitution**. C'est le signe qu'on n'a pas ajouté de complexité, on a ajouté de la mémoire.

### Un détail qui compte : la grille appartient à l'objectif, pas à l'action

Tentant de mettre une grille par action, comme dans ta capture. Mais un objectif de course a
trois actions : ça ferait trois grilles sur une carte, et la question « est-ce que je m'y suis
mis aujourd'hui ? » n'a qu'une réponse. **Une grille par objectif**, une case remplie dès qu'une
de ses actions a été cochée, l'intensité donnée par les PP du jour. Pour une habitude — un
objectif, une action — les deux définitions coïncident exactement. Pour un vrai objectif, on
gagne une visualisation de l'assiduité à l'entraînement, gratuitement.

## 5. Le visuel : quelle grille

Trois géométries possibles, à regarder dans la maquette jointe.

| | Ce que ça montre | Le problème |
|---|---|---|
| **Année pleine** (53 × 7) | Le récit complet, l'effet « regarde ce que j'ai construit » | 2 px par case sur un téléphone. Et en janvier, 95 % de gris : un reproche permanent |
| **12 semaines** (12 × 7) | Le trimestre — l'horizon utile d'une habitude | Perd le récit long |
| **30 derniers jours** (1 × 30) | Très compact, se lit comme une chaîne | Perd les motifs par jour de semaine (« je saute toujours le dimanche ») |

**Recommandation : 12 semaines par défaut, année en option sur ordinateur.** Le trimestre tient
sur un téléphone avec des cases de 14 px, garde les jours de la semaine en lignes — donc les
motifs restent lisibles — et couvre l'horizon sur lequel une habitude se joue vraiment.

Trois règles non négociables sur ce visuel :

- **La grille ne commence jamais avant la création de l'objectif.** Une année vide affichée dès
  le premier jour transforme un outil d'encouragement en bilan d'échec. Même raison qui a fait
  qu'un palier « jalon » n'affiche pas de barre à zéro.
- **Une case vide est neutre, jamais rouge.** On éclaire ce qui a été fait ; on ne surligne pas
  ce qui manque.
- **La couleur est celle du rang de l'objectif.** Chaque habitude a sa teinte, comme dans ta
  capture — sauf qu'ici la teinte veut dire quelque chose.

## 6. Là où on peut faire mieux que la référence

Ta capture affiche un sous-titre : *« Never fail twice in a row »*. C'est **exactement** la règle
des deux jours, déjà documentée dans l'étude sur le quotidien : rater un jour est du bruit, en
rater deux est un signal. Sauf que dans cette app, c'est une phrase décorative — rien dans
l'interface ne la fait respecter.

Zénith peut la rendre réelle, et c'est la seule chose que je propose d'ajouter au-delà de la
restitution :

- la grille **entoure la case d'hier** quand elle est vide et qu'aujourd'hui ne l'est pas encore
  — un seul repère, une seule fois, jamais deux jours de suite ;
- l'échelle d'une habitude reste en **`compte`** (jours cumulés), pas en `serie`. Un compteur qui
  retombe à zéro après quarante jours est le mode d'échec le mieux documenté du domaine — on l'a
  déjà tranché pour le tabac. La consécutivité se joue dans la règle des deux jours et dans le
  streak, pas dans l'échelle des rangs.

Autrement dit : **la grille montre l'histoire, le streak montre l'élan, la règle des deux jours
montre le seul danger réel.** Trois choses, chacune à sa place, aucune redondante.

## 7. Ce que ça change, écran par écran

| Écran | Changement |
|---|---|
| **Hub — Aujourd'hui** | Rien. Le geste est identique. |
| **Hub — Ce que ça construit** | Une habitude en entretien n'y figure plus (plus de palier à viser) |
| **Carte d'objectif repliée** | La grille apparaît sous la barre de paliers |
| **Carte dépliée** | Inchangée : l'échelle et les actions |
| **Objectif accompli** | Devient « Entretien » tant que ses actions sont encore cochées |
| **Bibliothèque** | Une neuvième catégorie : « Habitudes » |
| **Rang du profil** | Inchangé — une habitude monte en rang comme le reste, et une année sans se ronger les ongles vaut bien un Challenger |

## 8. Découpage

| # | Lot | Contenu | Risque |
|---|---|---|---|
| 1 | **La grille** | Composant, 12 semaines + année, couleur de rang, bornée à la création | faible, purement visuel |
| 2 | **Entretien** | Troisième état d'un objectif, exclusion de « Ce que ça construit » | faible |
| 3 | **Catégorie Habitudes** | ~10 modèles en un tap : méditer, journal, eau, lecture, ongles, écrans, doigts, marche, vaisselle, coucher | faible, c'est du contenu |
| 4 | **Règle des deux jours** | Repère sur la case d'hier, une seule fois | moyen — c'est le seul endroit où l'app prend la parole |

Le lot 1 peut partir seul et se suffit à lui-même. Le lot 3 est ce qui règle vraiment ton
problème d'entrée.

## 9. Les trois décisions qui t'appartiennent

1. **La géométrie par défaut** : 12 semaines, ou année pleine ?
2. **La grille partout, ou seulement sur les habitudes ?** Je penche pour partout — un objectif
   de course gagne à montrer son assiduité — mais ça charge les cartes.
3. **L'entretien : automatique ou choisi ?** Automatique (tous les paliers validés + une action
   cochée dans les 30 derniers jours) ou déclaré à la main sur l'objectif ?

## 10. Ce que je refuse d'ajouter, et pourquoi

Pour que « ça reste simple » ne soit pas qu'une intention, voici la liste explicite de ce que ce
sprint **n'ajoutera pas**, même si les apps d'habitudes le font :

- pas de fréquence configurable (« 3 fois par semaine ») — c'est la porte d'entrée vers un
  moteur de récurrence, et Zénith n'a pas besoin de savoir quel jour tu *devais* méditer ;
- pas de rappel par habitude — il y en a un, quotidien, et il suffit ;
- pas d'entrée de navigation « Habitudes » ;
- pas de second modèle de données ;
- pas de note d'humeur, pas de journal, pas de score de bien-être.

---

## 11. Ce qui a été construit — et les deux choses que l'étude n'avait pas vues

**Décisions retenues** : grille de 12 semaines, sur *tous* les objectifs, entretien automatique,
règle des deux jours discrète.

### La correction n° 1 : « Habitudes » ne pouvait pas être une catégorie

L'étude proposait une neuvième catégorie dans la bibliothèque. En l'écrivant, la contradiction
est apparue tout de suite : la bibliothèque **contenait déjà treize habitudes**, rangées dans
leur domaine de vie — méditer dans « Esprit », boire de l'eau dans « Santé », arrêter de fumer
dans « Arrêter ». Une neuvième catégorie aurait obligé soit à les dupliquer, soit à vider les
catégories dont elles venaient (« Esprit » n'aurait plus rien contenu du tout).

La cause : **une habitude n'est pas un domaine de vie, c'est une forme.** Mélanger une forme à
une liste de domaines est une erreur de taxonomie, et elle se paye immédiatement.

D'où le choix final : un drapeau `habit` sur le modèle, et un onglet « Habitudes » qui
**traverse** les huit domaines au lieu de s'y ajouter. Seize habitudes y figurent, dont treize
qui existaient déjà et qui n'ont pas bougé de place. Trois seulement ont été ajoutées : se ronger
les ongles, se craquer les doigts, l'écran avant de dormir.

### La correction n° 2 : « jours d'affilée » aurait été un mensonge

L'échelle d'une habitude est en `compte`, pas en `serie` — un compteur qui retombe à zéro après
quarante jours est le mode d'échec le mieux documenté du domaine, et il frappe précisément les
gens qui tenaient. Mais alors l'intitulé ne peut pas dire « 30 jours d'affilée » : ce n'est pas
ce qui est compté. D'où **« 30 jours réussis »**, qui dit exactement la vérité — même règle que
celle tirée du sprint précédent sur « Ma meilleure série ».

La consécutivité n'est pas abandonnée pour autant. Elle vit ailleurs, et mieux : dans le streak,
et dans la règle des deux jours, qui signalent le danger **sans effacer le travail**.

### Ce qui a été livré

| Lot | Contenu |
|---|---|
| 1 | `heatmap.ts` (grille, intensité relative, bornée à la création) + `Heatmap.tsx` + CSS |
| 2 | `goalState()` — `en-cours` / `entretien` / `accompli`, observé et non déclaré |
| 3 | Onglet transversal « Habitudes » + 3 modèles + 13 marqués |
| 4 | `missedYesterday()` — un repère orange sur hier, jamais deux jours de suite |
| — | Le compteur du prochain palier sur la carte repliée, qui manquait |

**196 tests unitaires, 162 vérifications de bout en bout.**

### Deux détails de mise en page qui n'étaient pas gratuits

- La grille était d'abord dans la colonne du titre : sur téléphone elle partageait la largeur
  avec les boutons d'action et se faisait couper **à droite**, c'est-à-dire précisément sur la
  colonne d'aujourd'hui — la seule qu'on regarde. Elle est passée au niveau de la carte.
- L'intensité de niveau 1 était à 42 % d'opacité : indiscernable d'une case vide sur les rangs
  pâles (Argent, Fer). Remontée à 55 %.

### Reste ouvert

- Le §10 de l'étude sur les paliers comptables : avertir avant de supprimer une action qui
  alimente un palier en cours.
- La bascule « année pleine » sur ordinateur (lot 1 bis) — le socle est là, `goalHeatmap` prend
  déjà un nombre de semaines en paramètre.

---

## 12. « Comment on sait quelles actions on a faites ? »

Question de Jules après la livraison. Réponse honnête : **on ne pouvait pas.** La grille répond à
« est-ce que je m'y suis mis ce jour-là », ce qui suffit exactement tant qu'un objectif n'a
qu'une action — le cas de toutes les habitudes. Dès qu'il en a trois, la case allumée ment par
omission : « sortie longue » et « sortie de 15 min » y ont la même tête.

Trois façons de le régler ont été pesées :

| | Pour | Contre |
|---|---|---|
| **Une grille par action** | La réponse la plus directe | Trois grilles sur une carte de course. C'est exactement la prolifération qu'on voulait éviter |
| **Une infobulle enrichie** | Gratuit | Ne marche pas au doigt — donc pas sur téléphone, donc pas là où l'app se lit |
| **Une case se clique** ✅ | Marche au doigt et à la souris, une seule grille, aucun écran de plus | Une ligne de plus sur la carte |

Retenu : **le clic**. Une ligne sous la grille nomme ce qui a été fait, avec les quantités quand
il y en a — « jeudi 23 juillet — Sortie course (6 km) ». Re-toucher referme. La ligne est
toujours présente (elle affiche une invite quand rien n'est sélectionné) pour que le clic ne
fasse pas sauter la carte.

Deux détails qui n'étaient pas gratuits :

- **Un seul arrêt de tabulation pour douze semaines.** Quatre-vingt-quatre boutons dans l'ordre
  du clavier rendraient la page intraversable : la grille est un unique élément focalisable, les
  flèches déplacent la sélection, et la ligne de détail est un `role="status"` — donc annoncée à
  chaque déplacement.
- **Une action supprimée ne fait pas disparaître son jour.** Le check-in survit à l'action
  (`action_id` passe à `null`) : le détail affiche « action supprimée » plutôt que rien.

Reste possible si le besoin revient : une bande de trente jours par action, dans la carte
dépliée, à côté de chaque action — pour répondre non plus à « qu'est-ce que j'ai fait ce
jour-là » mais à « laquelle de mes trois actions je ne fais jamais ».

---

## 13. Filtrer par action, et la case vide qui manquait

Deux retours de Jules, tous deux justes.

**« Il faudrait pouvoir filtrer par action. »** Le clic du §12 répond à « qu'est-ce que j'ai fait
ce jour-là ». Il ne répond pas à **« laquelle de mes trois actions je ne fais jamais »** — et
c'est la question la plus utile des deux, parce qu'elle se voit d'un coup d'œil et qu'on ne
pense jamais à la poser.

Une rangée de pastilles au-dessus de la grille : *Tout · Sortie longue · Sortie course ·
Renforcement*. La grille se recalcule sur la seule action visée, la pastille active prend sa
teinte, et le compteur de jours suit. Trois conséquences pensées :

- **Le filtre n'apparaît que s'il y a plus d'une action.** Pour une habitude — un objectif, un
  geste — la grille de l'objectif *est* celle de l'action ; proposer un choix entre une seule
  option serait du bruit pur.
- **Une grille vide sous filtre ne disparaît pas.** Ailleurs, une grille sans un seul jour actif
  n'est pas rendue (elle ferait passer un objectif neuf pour un échec). Sous filtre c'est
  l'inverse : le vide *est* l'information, et la ligne le dit — « Jamais fait sur les douze
  dernières semaines. »
- **La règle des deux jours suit le filtre.** Filtré sur « Sortie longue », le repère orange
  parle de cette action-là.

**« Il faudrait un placeholder sur les jours où j'ai rien fait. »** La case vide était à
`--bg-2` sur la surface d'une carte : deux points de luminosité d'écart, donc invisible. La
grille se lisait comme des carrés flottants séparés par du vide, au lieu d'un calendrier avec
des cases pleines et des cases vides. Corrigé — **c'est le vide qui donne son sens au plein**,
et sans lui on ne peut ni compter les trous ni voir un motif hebdomadaire.

**196 → 201 tests unitaires, 168 → 177 vérifications de bout en bout.**

---

## 14. Trois états de case, pas deux

La grille distingue maintenant **trois** choses là où elle n'en distinguait que deux :

| | Rendu | Ce que ça dit |
|---|---|---|
| Jour actif | Rempli, teinte du rang | fait, et à quelle intensité |
| Jour manqué | Case sombre, contour net | l'objectif existait, je n'ai rien fait |
| Avant la création | Contour très léger, sans fond | ce jour ne me regarde pas |

Le troisième manquait, et son absence se voyait précisément là où elle faisait le plus de mal :
sur un objectif **créé aujourd'hui**, la grille devenait quatre-vingt-trois trous et une seule
case. Un utilisateur y lit un bug d'affichage, pas une intention.

Le principe de départ reste entier — on ne reproche pas des jours où l'objectif n'existait pas —
mais il se dit maintenant par une **nuance**, pas par une disparition. C'est la même leçon que
sur les cases vides du §13 : ce qui n'est pas dessiné n'informe de rien, il faut le dessiner
faiblement pour qu'il informe faiblement.

Deux vérifications gardent l'écart : le contour d'un jour d'avant la création existe, et il est
différent de celui d'un jour manqué.

---

## 15. Le streak par habitude, et l'année

Les deux dernières pièces du plan.

### Le chiffre qui manquait

La maquette du §5 promettait « 🔥 7 jours d'affilée » sous chaque habitude. Seul le total avait
été livré. Or **la flamme de Zénith est globale** : elle compte les jours où on a fait
*quelque chose*, tous objectifs confondus. C'est le bon chiffre pour le profil et le mauvais
pour une habitude — « je tiens depuis douze jours sur celle-là » est précisément ce qu'on veut
savoir, et c'est ce que le compteur global ne peut pas dire.

`goalStreak()` répond, avec deux règles :

- **Même tolérance que le streak global** : rien fait aujourd'hui ne casse rien tant que la
  journée n'est pas finie. Sans ça le compteur retomberait à zéro tous les matins à 8 h.
- **Pas de gels.** Un gel protège le streak du profil, celui qu'on perdrait vraiment. En
  distribuer un par objectif reviendrait à en donner autant que d'objectifs, et à vider le
  mécanisme de son sens.

Et une règle d'affichage : **rien à zéro.** « 0 jour d'affilée » n'est pas une information,
c'est un reproche. Le total, lui, reste affiché. Le streak suit le filtre par action, ce qui
donne au passage la réponse à « ma sortie longue, je la tiens vraiment toutes les semaines ? ».

### L'année

Un bouton dans le pied de la grille, qui nomme sa destination (« Année » / « 12 semaines »)
plutôt que son état. Cinquante-trois colonnes couvrent une année entière quel que soit le jour
où elle commence.

La case tombe à 6 px plutôt que de forcer un défilement : une vue longue qui défile perd sa
seule raison d'être, qui est de tout voir d'un coup. Sur un téléphone la largeur ne suffit
quand même pas — là, la grille défile et **s'ouvre sur la fin**, parce que la colonne qu'on
vient regarder est celle d'aujourd'hui.

Trois pièges rencontrés, tous du même genre — une largeur qui n'était pas celle qu'on croyait :

1. **Les étiquettes de mois dérivaient.** `min-width: auto` est la valeur par défaut d'un
   élément flex : chaque étiquette s'élargissait à la taille de son texte et poussait les
   suivantes, si bien que « juin » finissait au-dessus d'août. Un `min-width: 0` et le texte
   déborde de sa colonne sans jamais la déplacer.
2. **Le défilement automatique décalait tout.** Il visait `scrollWidth` du conteneur, qui inclut
   le débordement de la dernière étiquette : la vue glissait de quinze pixels vers la gauche et
   le premier mois s'affichait « ût ». Le décalage se mesure sur la **grille**, pas sur le
   conteneur.
3. **La carte s'élargissait au lieu de laisser défiler.** Même cause que le panneau de création
   deux sprints plus tôt : un élément de grille a `min-width: auto`, donc la largeur de son
   contenu. Sur téléphone, la carte débordait de l'écran en emportant le bouton de bascule.

**201 → 208 tests unitaires, 181 → 186 vérifications de bout en bout.**

### Il ne reste qu'une chose au plan

Avertir avant de supprimer une action qui alimente un palier en cours (§10 de l'étude sur les
paliers comptables). Rien à voir avec les habitudes, mais c'est un problème de confiance : la
suppression fait chuter un compteur sans prévenir.
