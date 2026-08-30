# Ce qui manque à Zénith pour une V1

*Étude des sept points remontés par Jules le 9 août 2026. Chaque constat a été
vérifié dans le code avant d'être commenté — les deux « bugs potentiels » sont
confirmés, et un troisième, non signalé, est apparu en chemin.*

---

## Résumé — l'ordre que je recommande

| # | Chantier | Effort | Pourquoi ce rang |
|---|---|---|---|
| ~~1~~ | ~~Ombre de l'anneau rognée~~ | 1 ligne | **Fait le 9 août.** `overflow: visible` sur le `<svg>` |
| ~~2~~ | ~~Gels comptés deux fois~~ | ~10 lignes | **Fait le 9 août**, les deux volets (réserve annoncée + survie à la rupture) |
| ~~3~~ | ~~L'échelle des rangs peut redescendre~~ | ~30 lignes | **Fait le 9 août** par déplacement — voir la réserve §3 bis sur l'ajout |
| ~~4~~ | ~~Création : type global + cible devinée~~ | 1 à 2 jours | **Fait le 9 août** — et la nature devient une propriété de l'objectif, dont tout palier ajouté hérite |
| ~~5~~ | ~~Insérer un palier au milieu~~ | ~½ jour | **Fait le 9 août** — un « + » entre deux paliers, l'échelle se redistribue |
| ~~6~~ | ~~Donner un sens aux PP~~ | décision d'abord | **Fait le 10 août** — les PP se comptent par semaine et achètent des gels |
| **7** | Animations | 2 à 3 jours | **Suspendu le 26 août.** Pas prioritaire pour le moment |
| **8** | Onboarding | 1 jour | En dernier — et même plus tard que tu ne le penses, voir §8 |

---

## 1. Bug confirmé — l'ombre de l'anneau s'arrête au carré

**Ton constat est exact, et la cause est nette.** Quand l'objectif du jour est
atteint, `.ring-wrap.done .ring-progress` pose un `filter: drop-shadow(0 0 10px …)`
sur le cercle. Or un filtre appliqué à un enfant de `<svg>` est rastérisé
**dans le viewport SVG**, et tout ce qui dépasse est coupé.

Les chiffres : le cercle a un rayon de 84 et un trait de 14, donc son bord
extérieur est à 91 du centre ; le viewBox fait 196, soit 98 de demi-côté. Il
reste **7 px** de marge pour un halo qui en demande 10. Le halo est donc tranché
net sur les quatre côtés — d'où l'impression de bord droit.

**Correctif : une ligne.** Le viewport SVG rogne par défaut ; il suffit de le lui
interdire.

```css
.ring-wrap svg {
  transform: rotate(-90deg);
  display: block;
  /* Sans ceci, le halo du `drop-shadow` est tranché net au bord du viewport
     SVG : le cercle s'arrête à 7 px du bord pour un flou qui en demande 10. */
  overflow: visible;
}
```

Vérifié en captures avant/après sur le build réel : le halo redevient rond.

---

## 2. Bug confirmé — les gels sont annoncés alors qu'ils sont déjà engagés

**Ton doute était fondé.** Mesure sur `computeStreak`, avec 14 jours d'affilée
puis deux jours vides :

| Jour | Ce que l'app affiche | Ce qui est vrai |
|---|---|---|
| 14 (dernier jour actif) | 14 jours · **2 gels** | correct |
| 16 (les 15 et 16 vides) | 14 jours · **2 gels** | **0 gel** : les deux sont réservés aux 15 et 16 |
| 17 (après avoir coché) | 15 jours · **0 gel** | correct |

La branche `!activeToday` renvoie `freezes` sans en retrancher les `missed`
jours déjà manqués. Le compteur est donc juste **sauf pendant la fenêtre où on
le consulte** : celle où on se demande justement si on peut se permettre de
sauter encore un jour. L'app répond « tu as deux jokers » alors qu'il n'en reste
aucun.

Correctif : soustraire `missed` de la réserve annoncée dans cette branche.

### Et un second, non signalé : les gels survivent à la rupture

Même sonde, 21 jours d'affilée (3 gels), puis dix jours d'absence, puis une
reprise :

```
{ current: 1, best: 21, freezes: 3 }
```

La série est repartie de zéro, mais les trois gels sont toujours là. Deux
conséquences : on affiche une récompense gagnée par une série qui n'existe plus,
et surtout **les trois prochains trous d'une habitude toute neuve seront absorbés
en silence**. C'est l'inverse de l'intention : le gel est censé récompenser une
régularité déjà installée, pas amortir un redémarrage fragile.

Aucun test ne fige le comportement actuel — la décision reste ouverte. Je
recommande de remettre la réserve à zéro en même temps que la série (`current = 0`
et `freezes = 0` dans la même branche), et de l'écrire dans le commentaire de
tête, qui est aujourd'hui muet sur ce cas.

---

## 3. Bug non signalé — l'échelle des rangs peut redescendre

Découvert en instruisant ton point sur l'insertion d'un palier. Le scénario est
exactement le tien : un objectif à trois paliers, on veut en glisser un entre le
2ᵉ et le 3ᵉ. La seule voie offerte par l'interface est *ajouter à la fin, puis
remonter avec ↑*. Résultat mesuré :

```
Courir 5 km = bronze | Courir 10 km = argent | Courir 15 km = challenger | Courir 21 km = or
```

`reorderTiers` ne réécrit que les positions ; le rang reste collé au palier. On
obtient une échelle qui **redescend** au dernier barreau, et un palier facile
décoré du rang le plus prestigieux. Tout le produit repose sur cette montée : la
laisser s'inverser en silence est plus grave que les deux bugs précédents.

**Correctif retenu — et il n'est pas celui que j'avais proposé.** Ma première
idée était de recalculer toute l'échelle depuis `suggestRanks(n)` à chaque
modification. En l'écrivant, je suis tombé sur une décision déjà prise et
documentée dans `ranks.ts` : « l'utilisateur reste libre de les changer un par
un ». Un recalcul systématique aurait écrasé en silence chaque rang choisi à la
main — je serais allé corriger un bug en en créant un autre, plus sournois.

La règle finalement retenue est plus étroite et se dit en une phrase : **les
rangs appartiennent aux barreaux, pas aux paliers.** Un déplacement échange les
deux paliers *et* leurs rangs, si bien que la suite des rangs de l'échelle ne
bouge jamais — seul son contenu change de barreau. C'est exactement ce qu'on
veut en glissant une étape entre deux autres, et ça préserve intégralement une
échelle personnalisée à la main.

L'exception reste non négociable : **un palier déjà validé garde son rang**,
parce que c'est un trophée gagné à une date donnée ; le réécrire réécrirait
l'historique, ce que le projet s'interdit partout ailleurs (les PP sont figés à
l'enregistrement pour la même raison). Un déplacement qui toucherait un palier
validé est donc **refusé** plutôt qu'exécuté à moitié, et la flèche est grisée
avec l'explication en infobulle.

Résultat sur le scénario d'origine :

```
Courir 5 km = bronze | Courir 10 km = argent | Courir 15 km = or | Courir 21 km = challenger
```

### 3 bis. Ce qui reste ouvert : l'ajout peut encore créer une échelle qui descend

Le formulaire d'ajout laisse choisir le rang parmi les dix, sans tenir compte
du dernier barreau. Rien n'empêche donc d'ajouter « Maître » après
« Challenger » — et les vérifications de bout en bout le font sans le vouloir,
ce qui est révélateur : la liste déroulante invite à l'erreur, parce que
**l'ordre des rangs n'est pas devinable** (Challenger est au-dessus de Maître,
ce que seuls les joueurs de LoL savent — tu l'avais toi-même relevé en
demandant « bronze, argent, or, challenger — pas maître »).

**Corrigé le 9 août — et le diagnostic avait changé entre-temps.** En allant le
réparer, j'ai constaté que la liste ne produisait plus d'échelle descendante :
depuis que l'ajout calcule le rang à partir de la place, le choix affiché
n'était tout simplement **plus honoré**. On choisissait « Maître » et on
obtenait « Challenger », sans un mot. Une liste qui ment est pire qu'une liste
restreinte.

Elle a donc été supprimée : le formulaire **annonce** le rang que prendra
l'étape au lieu de le demander. La liberté n'est pas perdue — chaque palier
garde son sélecteur de rang une fois créé, ce que `ranks.ts` documente depuis
toujours.

Une fois ce point réglé, **ton point 4 devient presque gratuit** : « ajouter puis
remonter » produit enfin une échelle correcte, et un vrai bouton « insérer ici »
n'est plus qu'un raccourci de confort.

---

## 4. Création d'objectif : ton idée est la bonne, et mieux que tu ne le penses

**Le constat d'abord.** Pour rendre un palier écrit à la main comptable, il faut
le déplier, choisir parmi six natures, taper une cible, taper une unité. Quatre
paliers = seize interactions dont quinze répètent la même information. C'est le
plus gros frottement de l'app aujourd'hui, et il tombe au pire moment : la
création, c'est-à-dire avant le premier bénéfice.

**Sur le type global : oui, sans réserve.** Un objectif dont les paliers mélangent
les natures est l'exception, pas la règle — sur les 32 modèles de la
bibliothèque dont les paliers sont chiffrés, **un seul** mélange les natures
(« Marcher 10 000 pas par jour » : deux paliers en jours, puis deux randonnées
en kilomètres). Poser la question une fois
(« comment se comptent ces paliers ? ») et l'appliquer à tous, en laissant
l'exception se corriger palier par palier, est le bon défaut.

**Sur la détection du nombre dans le titre : j'ai testé ton idée plutôt que d'en
juger.** Sonde passée sur les 66 paliers chiffrés de la bibliothèque, avec la
règle la plus bête possible — *le premier nombre du titre est la cible, le mot
qui le suit est l'unité* :

```
nombre juste          : 64 / 66  (97 %)
nombre + unité justes : 63 / 66  (95 %)
```

Trois échecs seulement, et les trois sont instructifs :

- **« Courir un semi-marathon »** — aucun chiffre. L'utilisateur tape la cible ;
  c'est l'exception assumée.
- **« Nager 1 km sans pause »** — cible réelle 1000 m : le modèle a choisi une
  unité différente de celle du titre. Aucun parseur ne peut deviner ça, et il ne
  devrait pas essayer.
- **« 1er versement effectué »** — « er » pris pour une unité. Un garde-fou sur
  les ordinaux suffit.

Autrement dit : cinq lignes de code couvrent 95 % des cas. **Fais-le.**

**La limite à ne pas franchir : ne devine jamais la *nature*.** « 30 pompes
d'affilée » et « 30 séances » portent le même nombre et n'ont rien à voir — l'un
est une performance, l'autre un compte. Le nombre est dans le titre, la nature
n'y est pas. C'est précisément ce qui rend ton autre idée — le type choisi une
fois pour l'objectif — complémentaire et non redondante : **le type vient de la
question globale, la cible vient du titre.** Les deux ensemble ramènent les seize
interactions à une seule.

---

### 4 bis. Ce qui a été construit, et le trou qu'on n'avait pas vu

La demande a évolué en cours de route, et pour le mieux : il ne s'agissait pas
d'appliquer une nature *en bloc à la création*, mais que **l'objectif porte sa
nature** — de sorte qu'un palier ajouté six mois plus tard en hérite au lieu de
renaître « à cocher ». Sans ça, le frottement revenait par la porte de derrière.

Cette nature est **déduite, jamais stockée** : le type d'un objectif *est* celui
de ses paliers, comme le streak est celui de ses réalisations. Elle s'affiche
pourtant comme une propriété — « Ces paliers se comptent en **Total** · € » sur
la carte — et la changer requalifie toute l'échelle. Aucune migration, aucun
champ à tenir à jour, aucune contradiction possible, et l'effet est rétroactif
sur les objectifs qui existent déjà.

**Le trou découvert en chemin.** Un objectif naît avec deux actions génériques
**sans unité**. J'ai créé à la main un palier « Courir 100 km » en cumul, coché
« Un vrai effort » trois jours de suite, et mesuré : **0 / 100**. Pour toujours,
sans que rien ne le signale. C'est le défaut contre lequel un test protège les
39 modèles de la bibliothèque — mais rien ne protégeait les objectifs écrits à
la main. Livrer la nature globale sans ça, c'était livrer une fonctionnalité qui
*a l'air* de marcher. Les actions naissent donc désormais en portant l'unité de
l'objectif, avec une valeur habituelle devinée, visible et modifiable.

Trois décisions prises au passage :

- **« Série » est hors du choix global.** C'est la nature où un jour manqué
  efface tout ; le projet la réserve au tabac et à l'alcool.
- **« Mesure » y est**, et crée le relevé qui l'alimente — sinon sa courbe
  resterait vide.
- **La valeur habituelle est pré-remplie** (un dixième de la plus petite cible
  pour un cumul, la moitié pour une performance). Un champ vide ouvrirait le
  clavier à chaque coche, ce que tout le lot « un appui reste un appui » cherche
  à éviter.

---

## 5. Insérer un palier au milieu

Réel, mais **c'était déjà possible** — ajouter à la fin puis ↑ — et le vrai
problème n'était pas l'absence du geste, c'est qu'il produisait une échelle
fausse (§3).

**Ce qui a été fait.** Un « + » discret entre deux paliers, presque invisible
jusqu'au survol (et rendu visible au clavier dès que l'échelle a le focus :
sans ça, la porte serait introuvable pour qui n'utilise pas de souris). Il
ouvre un champ, on tape l'intitulé, l'étape se glisse à cette place. Elle
hérite de la nature de l'objectif comme n'importe quel palier ajouté, et sa
cible se lit dans son titre.

Côté rangs, deux cas :

- **Échelle jamais retouchée** : elle reprend simplement la suite standard de
  sa nouvelle longueur — exactement ce qu'on aurait eu en créant l'objectif
  avec un palier de plus. Bronze · Argent · Or · Diamant · Challenger devient
  Bronze · Argent · Or · Platine · Diamant · Challenger.
- **Échelle personnalisée** : les rangs choisis à la main sont intouchables, et
  le nouveau barreau se pose au-dessus du sommet.

Le premier cas a été ajouté après coup, en regardant le résultat : sans lui,
insérer dans une échelle qui touchait déjà Challenger donnait **deux barreaux
Challenger**. La règle générale — ne jamais réécrire l'échelle — restait juste,
mais elle avait un angle mort au plafond.

Et l'invariant vérifié n'est pas « aucun palier n'est rétrogradé » (trop fort :
une échelle qui s'allonge redistribue ses rangs) mais **« l'échelle ne descend
jamais »**, testé à toutes les places d'insertion, sur une échelle standard
comme sur une échelle retouchée.

---

## 6. Les PP — le problème n'est pas qu'ils ne servent à rien

Ta question est « 1000 ou 10 000 PP, qu'est-ce que ça signifie ? ». La réponse
est plus gênante que « rien » : **le rang du profil ne les regarde même pas.**

`profileRank()` calcule la moyenne des rangs des objectifs. Les PP, eux,
n'alimentent que trois choses : l'anneau du jour (40 PP), deux trophées à 500 et
2000, et une courbe dans l'historique. Il y a donc **deux systèmes de statut
parallèles** dans la même app — les rangs, gagnés en franchissant des paliers, et
les PP, gagnés en cochant des cases — et seul le premier veut dire quelque chose.
Le total à vie est un chiffre qui monte tout seul, ce qui est exactement la
définition d'une métrique vaniteuse.

Donc je ne recommande pas de « trouver un usage aux PP ». Je recommande de
trancher, dans cet ordre de préférence :

1. **Les PP deviennent un carburant, pas un trésor.** Ils restent la mesure de la
   journée (l'anneau, la seule chose qu'ils font déjà bien) et on remplace le
   total à vie du profil par « cette semaine » / « ce mois ». Le chiffre
   redevient lisible : 180 PP cette semaine contre 120 la précédente, ça se
   comprend en une seconde. 10 000 PP, non.
2. **Et on leur donne une dépense, une seule : les gels.** « 1 gel = 200 PP »,
   plafond inchangé à 3. C'est cohérent avec tout le reste — une bonne journée
   achète la protection d'une mauvaise — ça donne enfin un arbitrage au joueur, et
   ça ne demande aucun objet nouveau puisque les gels existent déjà. C'est
   d'ailleurs le modèle de Duolingo, dont tu apprécies le reste.

Ce que j'écarte : les ligues et les classements, qui exigent d'autres joueurs
(contrainte n° 2 du projet : utilisable seul dès le premier jour), et une
boutique cosmétique, qui demanderait de dessiner des objets pour un utilisateur
unique.

**À faire après les bugs, mais avant les animations** : décider ce que les PP
sont change ce qu'il y a à animer.

---

### 6 bis. Ce qui a été fait

Les deux gestes proposés, tranchés par Jules : le cumul à vie quitte le profil
au profit des **PP de la semaine** (le calcul existait déjà pour la carte
« Cette semaine »), et les PP gagnent **une seule dépense** — un gel à 200 PP.

Trois choses ont dû être décidées en chemin, et aucune n'était dans l'étude :

- **Avec quoi paie-t-on ?** Si le cumul à vie n'est plus affiché, payer avec
  lui reviendrait à réintroduire un trésor invisible. La monnaie est donc la
  **semaine en cours**. Les PP non dépensés ne se reportent pas — ils n'ont
  jamais été un solde, donc rien n'est repris à personne.
- **Un solde ou un journal ?** Un journal. La réserve de gels reste
  **recalculée** depuis l'historique des achats, exactement comme le streak est
  recalculé depuis les réalisations. Un compteur qu'on incrémente et décrémente
  aurait été la première donnée de l'app capable de dériver en silence.
- **Que devient un gel payé quand la série casse ?** Il survit. La règle
  « la réserve ne survit pas à la rupture » vaut pour ce qui a été *gagné* par
  cette série ; confisquer 200 PP pour trois jours manqués serait une punition
  déguisée. En interne la réserve est donc tenue en deux poches, pour un seul
  nombre à l'écran — « indistinguables » était la demande, et elle est tenue
  côté utilisateur.

Le bouton n'apparaît que lorsque l'achat est possible : un bouton grisé en
permanence afficherait un manque tous les jours.

### 6 ter. L'harmonisation qui a suivi

Deux surfaces parlaient encore l'ancien langage, relevées par Jules :

- **La courbe de l'historique** traçait le cumul à vie — le nombre qu'on venait
  de retirer du profil. Une courbe n'est pas tout à fait un nombre : elle porte
  une pente, donc une information. Mais une courbe cumulative la rend
  illisible, parce que l'œil compare des hauteurs et non des inclinaisons.
  Elle est devenue des **barres hebdomadaires**, avec les semaines vides
  dessinées à zéro : une pause de trois semaines se voit maintenant comme un
  creux, là où la courbe montrait « ça monte encore ».
- **Le doublon que j'avais créé la veille** : « PP cette semaine » sur le
  bandeau de profil ET « PP gagnés » sur la carte du hub, le même nombre à
  trente centimètres d'écart. Les PP ne vivent plus qu'à un endroit — la carte
  « Cette semaine », qui porte en plus le comparatif à la semaine précédente.
  Le bandeau garde ce qui dit l'identité : rang, streak, objectifs, paliers. Le
  solde disponible s'affiche là où il sert, sur le bouton d'achat.

---

## 7. Animations — d'accord sur le fond, en désaccord sur le modèle

> **Correction du 26 août — cette section partait d'un fait faux.**
> J'avais écrit plus bas que la fermeture de l'anneau du jour ne déclenchait
> rien. C'est l'inverse : en bouclant réellement une journée dans le build, on
> obtient une **cérémonie plein écran** « Objectif atteint · Journée bouclée »,
> avec confettis, fanfare, vibration, bouton « Continuer » et fermeture
> automatique à 5,2 s (`dayCelebrations` dans `ZenithScreen.tsx`,
> `kind: 'day'` dans `Ceremony.tsx`). Je l'avais lue dans le code sans jamais
> la déclencher.
>
> Le problème du moment quotidien n'est donc pas l'absence d'animation, c'est
> son excès : un écran qui s'interpose cinq secondes entre l'utilisateur et son
> app **tous les soirs** — exactement le péage que je reproche à Duolingo trois
> paragraphes plus bas. Toute reprise de ce chantier doit partir de là, pas du
> constat périmé ci-dessous.
>
> *Chantier suspendu à la demande de Jules le 26 août. Rien n'a été changé.*

L'app n'est pas nue : il y a déjà des cérémonies de palier, des confettis, le
« +15 » qui s'envole, la pastille qui rebondit. Ce qui manque n'est pas la
quantité, c'est **le pic** — aucun moment ne fait battre le cœur.

Mais je ne copierais pas le geste de Duolingo tel quel. Le « glisse pour allumer
la flamme » y fonctionne pour deux raisons qui ne sont pas les tiennes : la série
est **la** métrique de Duolingo, et l'animation sert de sas entre l'utilisateur et
sa récompense — acceptable une fois par jour dans une app de cours, pénible dans
un outil personnel qu'on ouvre trois fois par jour pour cocher une case. Une
animation qu'on subit tous les jours devient un péage en une semaine. Et le son
par défaut, dans une app qu'on ouvre au bureau ou au lit, se coupe une fois pour
toutes le premier jour (le réglage `zenith.muted` existe déjà).

Ce que je retiens de Duolingo, c'est **la variété** — ton mot, et c'est le bon.
Trois moments méritent un vrai traitement, et trois seulement :

1. **L'anneau du jour qui se referme.** C'est le seul rendez-vous quotidien
   garanti. ~~Aujourd'hui il ne se passe rien — juste un halo statique~~ →
   **faux, voir l'encadré en tête de section** : il s'y passe déjà une
   cérémonie plein écran de 5,2 s. La question n'est pas quoi ajouter, mais
   s'il faut la remplacer par quelque chose de discret et sur place.
2. **Les paliers de série** (7, 30, 100 jours). Rare, donc mémorable, et ça ne
   coûte rien de le rendre spectaculaire puisque personne ne le verra deux fois
   le même mois.
3. **Le passage de rang du profil.** Le vrai sommet du produit, et il passe
   aujourd'hui presque inaperçu.

Règle à tenir : **l'animation se déclenche après le geste, jamais avant.** On ne
met rien entre l'utilisateur et sa coche. Et tout reste soumis à
`prefers-reduced-motion`, déjà respecté ailleurs.

---

## 8. Onboarding — d'accord pour le faire en dernier, et pour une raison de plus

Ton argument est qu'il n'est plus d'actualité. Il y en a un autre, plus fort :
**Atlas va bientôt en avoir un deuxième**. Le jour où Astra existe, la première
chose à expliquer n'est plus « un objectif, des paliers » mais « voici un hub, et
voici ses modules ». Refaire l'onboarding de Zénith maintenant, c'est le refaire
deux fois.

Ce que je ferais en attendant, et qui coûte une heure : corriger ce qui est
devenu faux dans l'existant, sans y toucher autrement.

---

## Ce que je ne ferais pas pour la V1

- **Renommer les surfaces publiques en Atlas** — déjà tranché dans le journal, et
  toujours vrai : tant qu'il n'y a qu'un module, « Atlas » n'apprend rien à
  personne.
- **Préfixer les classes CSS du module** — 204 classes à renommer pour un gain
  qui n'apparaîtra qu'avec Astra. À faire au moment où ça sert.
- **Généraliser la file d'attente hors-ligne dans `core/`** — même raison : le
  jour où un second module écrit en mobilité, pas avant.
