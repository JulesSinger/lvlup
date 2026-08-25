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
| **4** | Création : type global + cible devinée | 1 à 2 jours | Le plus gros gain d'usage par unité d'effort. Parseur validé à 95 % |
| **5** | Insérer un palier au milieu | ~½ jour | Devient presque gratuit une fois le n° 3 fait |
| **6** | Donner un sens aux PP | décision d'abord | Ce n'est pas un manque de fonctionnalité, c'est une monnaie en trop |
| **7** | Animations | 2 à 3 jours | Réel, mais à cibler sur trois moments, pas « partout » |
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

Je ne l'ai pas corrigé ici : contrairement au déplacement, c'est un choix
explicite fait dans une liste visible, pas une corruption silencieuse — et le
corriger revient à restreindre une liberté documentée. Ma recommandation, à
trancher : **n'offrir à l'ajout que les rangs strictement au-dessus du dernier
barreau.** La liberté reste entière dans la plage qui a un sens, et le choix
incohérent devient inatteignable.

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

## 5. Insérer un palier au milieu

Réel, mais **c'est déjà possible** — ajouter à la fin puis ↑ — et le vrai
problème n'est pas l'absence du geste, c'est qu'il produit une échelle fausse
(§3). Une fois §3 corrigé, je proposerais un « + » discret entre deux paliers
au survol, qui préremplit le rang intermédiaire. Pas de nouvelle mécanique, pas
de nouveau modèle de données.

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

## 7. Animations — d'accord sur le fond, en désaccord sur le modèle

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
   garanti, et aujourd'hui il ne se passe rien — juste un halo statique, qui est
   en plus cassé (§1). Le corriger, puis animer sa fermeture, est le meilleur
   rapport effort/effet de toute la liste.
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
