# Relier les actions aux paliers — étude

*Août 2026. Point de départ : « si j'ai le palier "arrêter les écrans avant 00 h pendant
30 jours", l'action liée sera sûrement "arrêter l'écran avant 00 h", mais du coup on n'a pas
vraiment de suivi de cette action liée au palier. »*

*Révisée après deux objections de Jules : les mesures dans le temps (le poids), et le
rattrapage d'un oubli. Les deux entrent dans le sprint — la deuxième était même déjà à moitié
construite sans qu'on le sache.*

---

## 1. Le trou, précisément

Zénith fait aujourd'hui tourner **deux systèmes qui ne se parlent pas** :

- **les actions quotidiennes** produisent des PP, un streak, un historique ;
- **les paliers** sont des cases qu'on coche à la main, sans mémoire de ce qui les a préparés.

Concrètement, pour l'exemple des écrans : tu coches l'action tous les soirs pendant trois
semaines, et le palier « 30 jours » reste rigoureusement identique à ce qu'il était le premier
jour. Rien ne dit où tu en es, rien ne dit combien il en reste, et le jour où tu atteindras
30 il faudra que tu t'en aperçoives toi-même et que tu ailles cliquer « Valider ».

C'est un problème plus grave qu'un manque d'affichage. **La promesse de l'app est que le
quotidien construit les objectifs** — c'est écrit sur la page d'accueil, c'est le sens du mot
« palier ». Or aujourd'hui le lien n'existe que dans la tête de l'utilisateur. Les PP sont un
substitut : ils montent, mais ils ne montent vers rien de précis.

L'ironie est que **les données sont déjà là**. Chaque check-in porte son jour, son objectif et
son action. Il ne manque que la déclaration « ce palier se compte en jours de cette action » —
et tout le reste se déduit.

---

## 2. Le piège : « 10 km » et « 100 km » ne se comptent pas pareil

Première tentation : ajouter un compteur à chaque palier et additionner. Elle est fausse, et
la bibliothèque de modèles actuelle le prouve toute seule :

| Palier existant | Ce que ça veut dire | Ce qu'un compteur naïf en ferait |
|---|---|---|
| `Courir 10 km` | 10 km **d'une traite**, dans une séance | validé après deux sorties de 5 km ❌ |
| `100 km d'une traite` | idem, seuil de performance | validé au bout d'un mois de footings ❌ |
| `30 jours sans fumer` | 30 jours **consécutifs** | validé avec 30 jours dispersés sur six mois ❌ |
| `30 jours à 10 000 pas` | 30 jours **au total**, peu importe la dispersion | correct ✅ |
| `Perdre 5 kg` | un **état mesuré**, pas une accumulation | incomptable ❌ |

Cinq natures différentes s'écrivent avec la même grammaire. Un modèle unique se tromperait
sur quatre cas sur cinq — et se tromper en validant un palier trop tôt est pire que de ne rien
compter du tout : ça dévalorise la cérémonie, qui est le cœur émotionnel de l'app.

**D'où la proposition : le palier déclare sa nature.**

| Nature | Comment ça se compte | Exemples |
|---|---|---|
| **Jalon** | à la main, comme aujourd'hui | `Passer le permis`, `Publier le site` |
| **Cumul** | somme des occurrences ou des quantités | `30 jours à 10 000 pas`, `100 km ce mois` |
| **Série** | jours consécutifs | `30 jours sans fumer` |
| **Performance** | meilleure valeur d'une seule séance | `Courir 10 km`, `Nager 1 km sans pause` |
| **Mesure** | où en est une grandeur suivie dans le temps | `Perdre 5 kg`, `Économiser 3 000 €` |

Le **jalon reste le défaut**. Ne rien déclarer laisse le comportement actuel intact : aucun
palier existant ne change de sens, aucune migration de données n'est nécessaire.

---

## 3. Le point délicat : les séries, et la règle de la maison

C'est la seule vraie question de conception du sprint, et elle mérite qu'on s'y arrête.

Un palier « 30 jours consécutifs » implique qu'un jour manqué remette le compteur à zéro. Or
Zénith affiche en toutes lettres, sur sa page d'accueil, *« ton rang ne redescend jamais »* et
*« aucun point n'est retiré »*. Il y a là une tension réelle.

Ce que dit la recherche, et que le benchmark initial avait déjà relevé chez Habitica : la
remise à zéro est **le** mode d'échec des traqueurs d'habitudes. Un jour manqué efface
quarante jours d'efforts, ce qui déclenche l'*abstinence violation effect* — un seul écart
fait tout abandonner. Les travaux sur la formation des habitudes vont dans le même sens :
manquer un jour n'a pas d'effet significatif sur l'ancrage. Les applications qui s'en sortent
le mieux ne comptent pas des chaînes : elles suivent une **trajectoire** qui ne se
réinitialise jamais, ou distinguent l'oubli isolé du décrochage réel (*manquer un jour est une
donnée, en manquer deux est un signal*).

D'où trois décisions, dans l'ordre d'importance :

1. **Le cumul est le mode par défaut**, y compris là où la formulation dit « de suite ».
   Le besoin de régularité est déjà servi ailleurs, et mieux : par la flamme du streak, qui
   elle a ses gels.
2. **La série reste disponible** quand elle fait le sens même du palier — arrêter de fumer,
   arrêter de boire. Là, la consécutivité n'est pas une contrainte de motivation, c'est la
   réalité de ce qu'on mesure, et l'édulcorer serait malhonnête.
3. **Même en mode série, rien n'est effacé visuellement.** Le compteur courant peut retomber,
   mais la **meilleure série reste affichée à côté** — comme un record, définitivement acquis.

Et dans tous les cas, la règle qui ne bouge pas : **un palier validé reste validé.** Le
compteur peut redescendre, la validation est acquise pour toujours.

---

## 4. Les mesures : oui, et ça ne chamboule rien

*« Est-ce que le suivi de mesure n'est pas super important ? Suivi du poids dans le temps par
exemple. À voir si ça chamboule tout le reste. »*

**C'est important, et non, ça ne chamboule rien.** Je l'avais écarté trop vite.

### Pourquoi c'est important

Sans mesure, une catégorie entière d'objectifs reste orpheline du système. « Perdre du
poids » était précisément l'objectif que ton testeur trouvait manquant. Et surtout : un
objectif de poids **n'a pas d'action qui s'accumule**. On ne fait pas « un kilo » comme on
fait « un kilomètre ». Si on ne traite que le cumul, ces objectifs gardent des paliers cochés
à la main pour toujours — c'est-à-dire qu'ils restent exactement dans l'état qu'on essaie de
corriger.

Trois des huit catégories de la bibliothèque sont concernées : Santé (poids), Argent
(épargne), Sport (charge soulevée, chrono). Ce n'est pas un cas marginal.

### Pourquoi ça ne chamboule rien

Une mesure, c'est **une valeur et une date**. Or on ajoute déjà `value` aux check-ins pour les
actions quantifiées. Une mesure est donc un check-in comme un autre, avec une action d'un
genre particulier — « Se peser » plutôt que « Sortie course ».

Ce que ça ajoute vraiment, et c'est tout :

- une **direction** : `baisse` pour le poids, `hausse` pour l'épargne ou la charge soulevée ;
- un **point de départ** : « perdre 5 kg » n'a de sens que rapporté à une première mesure.
  On stocke la cible en delta (−5) et la référence est le premier relevé, ce qui évite de
  demander un poids cible que personne n'a envie de nommer ;
- une **courbe**, qui est de toute façon le vrai plaisir de ce type d'objectif — et le
  composant `PPChart` existe déjà comme patron.

### Deux subtilités qui comptent

**Un relevé n'est pas un effort.** Se peser ne mérite pas les mêmes PP qu'une sortie de 10 km,
sinon on farme des points en montant sur la balance. Les actions de type relevé rapportent peu
ou pas de PP, et s'affichent différemment — un relevé, pas une victoire.

**Le poids remonte, et c'est normal.** C'est là que la règle de la maison rend un service
inattendu : le jour où tu touches ta cible, le palier est validé **pour toujours**. Reprendre
deux kilos la semaine suivante ne te reprend rien. Aucune app de poids ne fait ça, et c'est
sans doute la chose la plus saine que Zénith puisse dire sur ce sujet.

---

## 5. Le rattrapage : tu as raison, et c'est presque déjà fait

*« Il faudrait que l'utilisateur puisse revenir faire des actions sur les jours précédents.
S'il s'endort en ayant oublié de valider, c'est perdu à jamais, il casse sa série. »*

C'est le trou le plus rentable de toute l'étude, pour trois raisons.

**Il distingue deux choses que l'app confond.** « Je ne l'ai pas fait » et « je l'ai fait et
j'ai oublié de le cocher » n'ont rien à voir. L'application ne peut pas faire la différence,
mais toi si. Aujourd'hui elle traite les deux comme un échec, ce qui est faux une fois sur
deux — et c'est exactement le déclencheur d'abandon décrit plus haut, à ceci près qu'il est ici
totalement injustifié.

**Il complète le rappel qu'on vient de construire.** La notification de 20 h attrape ceux qui
n'ont pas encore agi. Personne n'attrape celui qui a agi à 23 h 45 et s'est endormi. Le
rattrapage du lendemain matin est la deuxième moitié de ce filet.

**Il est déjà construit à 80 %.** En regardant le code :

- `store.addCheckin(goalId, day, actionId, pp)` **prend déjà le jour en paramètre** — c'est
  l'interface qui passe toujours « aujourd'hui », rien d'autre ;
- la contrainte d'unicité porte sur `(utilisateur, action, jour)`, donc une coche d'hier est
  déjà un cas légal ;
- et surtout, **le streak est recalculé depuis l'historique, jamais stocké**. Cocher hier
  répare donc la série toute seule, gels compris, sans une ligne de logique en plus.

Il reste l'interface, et une décision.

### Jusqu'où peut-on remonter ?

Sans limite, l'historique perd son sens : on remplirait un mois entier de bonne foi, et la
courbe ne voudrait plus rien dire pour soi-même. Avec une limite trop courte, on ne répond pas
au besoin.

**Je propose 48 h : hier et avant-hier.** C'est la fenêtre où l'on se souvient honnêtement de
ce qu'on a fait, et elle couvre le cas décrit (s'endormir, y revenir le lendemain) plus une
nuit de marge. Au-delà, on ne se souvient plus vraiment — on reconstruit.

### Comment ça se présente

Pas un calendrier à fouiller. Une bande discrète au-dessus d'« Aujourd'hui », qui n'apparaît
que si un jour récent est resté vide : *« Hier, rien de coché. Un oubli ? »* avec les mêmes
pastilles, en plus sobre. Elle disparaît dès qu'on l'a traitée ou ignorée.

### Trois détails à ne pas rater

- Les PP d'une coche rétroactive comptent pour **le jour concerné**, pas pour l'anneau
  d'aujourd'hui. `todayPP` filtre déjà par jour : rien à faire.
- La cérémonie de journée bouclée **ne se rejoue pas** pour un jour passé — ce serait une
  fausse joie.
- En revanche, si le rattrapage complète un palier comptable, **la cérémonie de palier part** :
  c'est une vraie victoire, simplement constatée avec un jour de retard.

---

## 6. Le modèle

### Ce qu'on ajoute à un palier

```
kind        'jalon' | 'cumul' | 'serie' | 'performance' | 'mesure'   (défaut : 'jalon')
target      nombre                — 30, 100, 10, −5
unit        texte                 — 'jours', 'km', 'kg', '€'
direction   'hausse' | 'baisse'   — pour mesure et performance
mode        'absolu' | 'delta'    — pour mesure
sources     liste d'actions       — quelles coches alimentent ce palier
```

### Ce qu'on ajoute à une action

```
unit           texte, optionnel   — 'km', 'min', 'kg'
default_value  nombre             — la valeur habituelle, 8
is_measure     booléen            — relevé plutôt qu'effort (peu ou pas de PP)
```

### Ce qu'on ajoute à un check-in

```
value   nombre, optionnel   — la quantité, ou la mesure du jour
```

### Comment le compte se fait

| Nature | Calcul |
|---|---|
| Cumul, sans unité | nombre de jours distincts où une action source a été cochée |
| Cumul, avec unité | somme des `value` des check-ins des actions sources |
| Série | plus longue suite de jours consécutifs se terminant aujourd'hui |
| Performance | plus grande (ou plus petite) `value` d'un seul check-in |
| Mesure | dernière `value` relevée, comparée à la cible et au point de départ |

Tout est **recalculé depuis l'historique**, jamais stocké — exactement comme le streak
aujourd'hui. Aucun compteur à maintenir, donc aucune désynchronisation entre appareils, un
import de sauvegarde qui retombe juste, et un rattrapage rétroactif qui répare tout seul.

### La validation automatique

Quand le compte atteint la cible, le palier se valide et **la cérémonie part au moment du
clic**. C'est le vrai gain émotionnel du sprint : ce soir-là, tu coches ta case comme les
vingt-neuf soirs précédents, et l'écran explose.

---

## 7. Les actions quantifiées, sans casser le geste

Le risque évident : si cocher « Sortie course » ouvre un clavier numérique, on a remplacé un
geste par trois, et le taux de check-in s'effondre.

La règle proposée : **un appui enregistre l'action avec sa valeur habituelle.** La pastille
affiche « 8 km » et sert à ajuster quand la sortie est différente — c'est une correction, pas
un passage obligé. Les actions sans unité ne changent pas du tout.

Seule exception : un **relevé** (le poids) n'a pas de valeur habituelle qui ait du sens. Là,
la saisie est le geste — mais c'est un geste qu'on fait une fois par semaine, pas tous les
jours à 23 h.

---

## 8. Quatre décisions avant de coder

| # | Question | Ce que je recommande |
|---|---|---|
| 1 | Les modèles disent « 7 jours **de suite** », « 30 jours **de suite** ». On bascule en cumul ? | **Oui**, sauf arrêt du tabac / de l'alcool. Et on réécrit le libellé pour qu'il dise la vérité. |
| 2 | Annuler une coche peut-il dévalider un palier atteint ? | **Non.** Le compteur redescend, la validation reste. |
| 3 | Jusqu'où remonter pour rattraper un oubli ? | **48 h** — hier et avant-hier. |
| 4 | Un relevé (se peser) entretient-il le streak ? | **Oui** : c'est une vraie discipline quotidienne. Mais il rapporte peu de PP, pour qu'on ne farme pas des points sur une balance. |

---

## 9. Découpage proposé

| # | Lot | Contenu |
|---|---|---|
| 1 | **Modèle** | Migration 8 : les champs ci-dessus. Fonctions de calcul pures pour les cinq natures, testées avant toute interface. |
| 2 | **Rattrapage** | Bande « hier », coches rétroactives sur 48 h. Le plus petit lot, et le plus rentable — l'essentiel existe déjà. |
| 3 | **Saisie** | Éditeur de palier : nature, cible, unité, actions qui comptent. Bibliothèque de modèles annotée — c'est ce qui fait que ça marche sans configuration pour les 36 objectifs existants. |
| 4 | **Boucle** | Alimentation par les check-ins, validation automatique, cérémonie au clic. |
| 5 | **Visuel** | Barres, compteurs, « +1 ce soir », meilleure série, projection. |
| 6 | **Quantités et relevés** | Unité et valeur par défaut, ajustement en un geste, actions de type relevé. |
| 7 | **Mesures** | Paliers de type mesure, direction, point de départ, courbe de suivi. |
| 8 | **Tests** | Les cinq natures, les jours dispersés, les séries cassées, le rattrapage, l'annulation après validation, les actions supprimées. |

Le lot 2 peut partir en premier et seul : il ne dépend de rien et répare un vrai défaut dès
demain. Les lots 1, 3, 4 et 5 forment le cœur. Les lots 6 et 7 se tiennent la main — les
relevés n'ont d'intérêt que si les mesures existent — et peuvent devenir un sprint à part si
l'ensemble devient trop gros.

---

## 10. Un point de vigilance

Supprimer une action qui alimente un palier ferait chuter son compteur — les check-ins
survivent (`action_id` passe à `null`), mais le lien est perdu. Comme un palier validé reste
validé, le seul cas gênant est un palier en cours. Prévoir un avertissement explicite :
« cette action alimente 2 paliers en cours ».

---

## 11. Ce que les lots 6, 7 et 8 ont réellement changé

*Écrit après coup, parce que deux trous n'étaient pas dans l'étude initiale.*

**Un appui reste un appui.** La règle du §7 est tenue : toucher une pastille enregistre la
valeur habituelle et rien d'autre. La pastille l'annonce avant le clic (« Sortie course ·
8 km »), un bouton `#` permet de corriger après coup, et seul un **relevé** ouvre une saisie —
parce que là, la saisie *est* le geste. Les actions sans unité n'ont pas bougé d'un pixel.

**Trou n° 1 — les deux mondes se mélangeaient.** Avec `sources` vide, un palier était alimenté
par *toutes* les actions de son objectif. Ajouter « Me peser » à un objectif de course aurait
donc gonflé le cumul « 100 km » de 78 kilomètres, et fait avancer d'un jour un palier
« 30 jours ». La règle ajoutée (`feedsByDefault`) est simple et n'a besoin d'aucune
configuration : **un relevé n'alimente qu'une mesure, un effort n'alimente jamais une mesure.**
Une liste de sources explicite continue de l'emporter, et une action inconnue passe — on ne
réécrit pas l'histoire.

**Trou n° 2 — la moitié des modèles étaient inatteignables.** Le lot 3 avait annoté les
*paliers* des 36 modèles, mais pas leurs *actions*. « Perdre du poids » avait quatre paliers de
mesure et aucun relevé : ils ne pouvaient être atteints par aucun geste. « Courir un
semi-marathon » avait quatre paliers en kilomètres et trois actions qui n'en portaient aucun.
Onze modèles ont été annotés (`qte(...)`, `releve(...)`), et quatre tests de garde interdisent
désormais qu'un modèle reparte avec un palier que rien ne peut nourrir.

**La mesure a sa courbe, pas sa barre.** Sur un poids, l'information n'est pas « où j'en suis »
mais **la pente** : deux kilos perdus puis repris ne se lisent que sur une courbe. Elle
apparaît au deuxième relevé, cadrée sur l'amplitude réelle (jamais depuis zéro, qui écraserait
tout en une ligne plate), avec le départ et la cible en pointillés. Son pied ne dit que ces
deux légendes — la barre juste au-dessus dit déjà le reste.

**Un palier écrit à la main peut devenir comptable.** Le panneau `#` de l'échelle propose les
six natures avec des réglages par défaut crédibles plutôt que des champs vides. « Perdre 5 kg »
se tape `5` dans un champ intitulé « Perdre » ; le signe négatif est une affaire de stockage,
pas d'utilisateur.

**Reste ouvert** : le §10 (avertir avant de supprimer une action qui alimente un palier en
cours), et la migration 8 à passer en base.

---

## 12. Retour de Jules — « 10 pompes puis 10 pompes, ça fait 20 ? »

Non, et c'était déjà juste : `performance` retient la **meilleure fois**, jamais une somme.
Trois jours à « Ma meilleure série · 10 pompes » laissent le palier « 30 pompes d'affilée » à
**10 / 30**. Un test le vérifie désormais sur le vrai modèle, pas sur un cas de laboratoire.

Mais le doute était fondé, pour deux raisons que le calcul ne réglait pas :

1. **La barre mentait par omission.** « 10 / 30 pompes » se lit spontanément comme un total qui
   monte. Rien à l'écran ne disait le contraire. Le compteur d'une performance affiche
   maintenant « en une seule fois ».

2. **L'action, elle, était bien ambiguë — et c'était mon erreur.** « Série du jour · 10 pompes »
   ne dit pas si 10 est le total de la séance ou la meilleure série. Quelqu'un qui fait 3 × 10 et
   corrige à 30 validait Challenger sans avoir jamais fait 30 d'affilée. Renommée
   « Ma meilleure série ». Même correction en natation : une « séance piscine » est un total de
   longueurs, pas une nage sans pause — elle ne porte plus de distance, et « Ma plus longue
   nage » la porte à sa place.

La leçon générale : sur un palier de performance, **l'intitulé de l'action doit dire la même
chose que l'intitulé du palier.** L'app ne peut pas vérifier qu'on n'a pas fait de pause ; tout
ce qu'elle peut faire, c'est ne jamais rendre la déclaration ambiguë.

**Au passage** : la validation automatique ne partait qu'au clic. Une coche arrivée d'un autre
appareil, d'un import ou de la file d'attente hors ligne laissait une barre pleine à côté d'un
palier non validé. Un rattrapage silencieux au chargement corrige ça — sans cérémonie, parce
qu'on ne fête pas une victoire découverte en rechargeant une sauvegarde.

---

## 13. La bibliothèque de modèles n'avait jamais eu de CSS

Rien à voir avec les lots comptables : `GoalPicker` et la cérémonie « ascension tracée » ont été
livrés dans un sprint antérieur **sans une seule règle de style** (`git diff` sur `styles.css`
le confirme : 387 lignes ajoutées, zéro supprimée). D'où les puces natives, le numéro d'étape
collé au titre (« 1 » + « 5 pompes » lu comme « 15 pompes »), les badges par-dessus le texte et
les cartes empilées sur une ligne.

Pourquoi les 140 vérifications de bout en bout n'ont rien vu : **elles comptaient des éléments,
pas des pixels.** `.picker-card` était bien au nombre de 7, chacune bien cliquable — et
illisible. Six vérifications géométriques ont été ajoutées : trois colonnes distinctes dans
l'aperçu, pas de puce native, cartes de hauteur réelle disposées en grille, champs de l'échelle
alignés, marches de la cérémonie séparées, et le panneau qui tient dans 390 px de large.
