# Onboarding — étude de l'existant et de ce qu'il faudrait

*26 août 2026. Dernier point de la liste V1. Toutes les observations ci-dessous
viennent du build réel, ouvert et parcouru — pas d'une lecture du code. C'est
délibéré : l'étude des animations avait conclu « il ne se passe rien » sur une
lecture de `Ceremony.tsx` sans jamais boucler une journée dans l'app, et
c'était faux. Ce qui est déduit du code plutôt que constaté à l'écran est
signalé comme tel.*

---

## Résumé

L'accompagnement de Zénith existe et il est bon. Ce qui n'existe pas, c'est
l'accompagnement d'**Atlas**. Le premier écran que voit 100 % des nouveaux
venus est celui qui n'explique rien, et le second module n'a aucun
accompagnement du tout.

| # | Chantier | Effort | Rang |
|---|---|---|---|
| 1 | Une phrase par module sur l'écran de choix | ~1 h | **Le plus rentable de la liste** |
| 2 | Rendre le marqueur « déjà vu » par module | ~2 h | Préalable technique au 3 |
| 3 | Un accompagnement Astra, sur le modèle de Zénith | ~½ j | Le vrai trou fonctionnel |
| 4 | « Revoir l'accompagnement » dans les réglages | ~1 h | Petit, mais répare une porte à sens unique |
| 5 | Aligner la page publique sur Atlas | 1 j+ | Hors périmètre : c'est le chantier §4 de CLAUDE.md |

**Ajout après relecture de Jules — et il avait raison contre moi.** J'avais
écrit qu'il ne fallait pas toucher aux trois écrans de Zénith. Sa remarque
(« l'onboarding côté Zénith est vieux et dépassé, il a été fait quand il n'y
avait pas toutes les features ») m'a fait aller vérifier dans le build plutôt
que dans le code. **L'accompagnement ne se contente pas d'être daté : il crée
un objectif cassé.** Voir §2.F, qui passe en tête de la liste :

| 0 | L'accompagnement crée un objectif qui ne peut pas progresser | ~1 h | **Bug, avant tout le reste** |

---

## 1. Ce qui existe, écran par écran

### Le parcours réel d'un compte tout neuf

```
  Page publique  →  Inscription  →  « Tes modules »  →  [Zénith]  →  3 écrans  →  1er objectif
   (parle de                        Zénith  Astra        ↓
    Zénith seul)                                      [Astra]  →  rien
```

**« Tes modules »** — deux cartes, un emoji et un mot chacune : `▲ Zénith`,
`✦ Astra`. Aucune phrase, aucune description. C'est le premier écran d'Atlas et
le seul que tout le monde traverse.

**L'accompagnement Zénith** (`modules/objectifs/components/Onboarding.tsx`) —
trois écrans puis un objectif :

1. 🪜 *Un objectif, des paliers* — « Courir un marathon » commence par 10 km,
   pas par 42.
2. 🛡️ *Chaque palier vaut un rang* — Fer → Challenger, le rang ne redescend
   jamais, la moyenne fait le rang de profil.
3. 🔥 *Un geste par jour* — le streak, et le gel qui couvre un oubli.
4. **Ton premier objectif** — trois modèles (Sport / Lecture / Écrans),
   l'intitulé modifiable, et les paliers affichés avec leurs rangs. Bouton
   « Créer et commencer ».

C'est du bon travail, et pour une raison précise : **ça ne se termine pas par
un bouton « J'ai compris », ça se termine par un objet créé.** L'utilisateur
sort de l'accompagnement avec quelque chose à faire aujourd'hui, pas avec un
écran vide et le souvenir de trois diapositives.

**Astra** — rien. On entre sur « Aperçu », deux camemberts vides, et « Aucune
écriture ce mois-ci » avec un seul bouton.

### Le déclenchement

Constaté dans le code (`ZenithScreen.tsx`) : l'accompagnement s'affiche si
`!loading && !onboardingDone && goals.length === 0`. Le marqueur est porté par
l'utilisateur (`zenith.onboarded.<userId>` en `localStorage`), pas par
l'appareil — un choix documenté et juste : un compte neuf dans un navigateur
déjà servi doit être accompagné, et c'est justement lui qui en a besoin.

---

## 2. Les problèmes, du plus large au plus étroit

### A. Le premier écran d'Atlas n'explique rien — et c'est le seul universel

« Tes modules » présente deux mots inventés à quelqu'un qui vient de créer son
compte. « Zénith » et « Astra » ne veulent rien dire tant qu'on ne les a pas
ouverts. Le hasard fait bien les choses pour Zénith — il est à gauche, et la
page publique n'a parlé que de lui — mais Astra n'a aucune chance : rien sur
cet écran ne dit qu'il s'agit d'un budget.

C'est le déséquilibre le plus net de tout le parcours : l'écran qui reçoit
**tout le monde** est celui qui a reçu **le moins d'attention**, et l'écran le
plus travaillé (les trois diapositives) n'est vu que par ceux qui ont deviné
juste au clic précédent.

### B. Astra n'a aucun accompagnement — et sa rampe d'accès est cachée

Vérifié à l'écran : le module s'ouvre sur « Aperçu », qui affiche deux
camemberts vides et propose « Ajouter une écriture ». Or la vraie porte
d'entrée d'Astra existe — **« Charger les catégories de départ »**, l'équivalent
exact de « Créer et commencer » chez Zénith — mais elle est sur l'onglet
**Catégories**, deux clics plus loin, invisible depuis l'écran d'arrivée.

Autrement dit : le bon geste de départ est déjà codé, il est simplement rangé
là où personne ne le cherche. C'est le problème le moins cher à corriger et
celui qui change le plus le premier contact.

Ajout : sans catégories, « Ajouter une écriture » mène à un formulaire dont le
champ le plus structurant est vide. On propose donc le deuxième geste avant le
premier.

### C. « Passer » est une porte à sens unique

`onSkip` appelle `markOnboarded` immédiatement. L'accompagnement ne revient
jamais — et il n'y a **aucune entrée dans les réglages** pour le rejouer
(vérifié : rien dans `SettingsPanel.tsx` ni dans `ZenithSettingsSection.tsx`).

Le cas qui fait mal n'est pas l'utilisateur curieux qui voudrait revoir les
diapositives, c'est celui-ci : quelqu'un passe l'accompagnement, tâtonne,
supprime son objectif d'essai — et se retrouve devant l'écran vide sans jamais
avoir lu ce qu'est un palier. La double condition
(`!onboardingDone && goals.length === 0`) le protège d'une répétition
intempestive, mais elle l'enferme aussi.

### D. Le marqueur ne connaît qu'un module, et porte son nom dans le socle

`core/lib/onboarding.ts` — donc du code de socle — manipule des clés
`zenith.onboarded.<userId>`. Deux choses à corriger ensemble :

- la clé nomme un module depuis le socle, ce que CLAUDE.md §4 interdit ;
- il n'y a qu'un booléen pour toute l'app, alors qu'il en faudra un par module
  dès qu'Astra sera accompagné.

C'est un préalable technique au chantier 3, pas un chantier en soi. Signature
visée : `hasOnboarded(userId, moduleId)` / `markOnboarded(userId, moduleId)`,
avec reprise de l'ancienne clé au profit du module objectifs — le même geste
qu'`adoptLegacyOnboarding` a déjà fait une fois, et qui peut servir de modèle.

### F. L'accompagnement crée un objectif qui ne peut pas progresser — mesuré

C'est le point le plus grave de l'étude, et je ne l'avais pas vu au premier
passage parce que j'avais lu l'accompagnement au lieu de le terminer.

**Mesure.** Parcours complet dans le build : trois écrans, modèle « Sport »,
« Créer et commencer ». L'objectif obtenu :

| | Ce que l'accompagnement produit | Ce que le même modèle produit par la création normale |
|---|---|---|
| Paliers | `0 / 5 km`, `0 / 10 km`, `0 / 15 km`, `0 / 21,1 km` — meilleure séance, en km | identiques |
| Actions | **« Un vrai effort · 15 PP »**, **« Un petit pas · 5 PP »** — sans unité, sans valeur | « Sortie longue · 12 km », « Sortie course · 6 km », « Sortie de 15 min · 2 km » |

Cocher « Un vrai effort » rapporte 15 PP et fait avancer le palier de **0 km**.
Le premier objectif de tout nouvel utilisateur est donc bloqué à `0 / 5 km`
pour toujours — exactement le défaut corrigé partout ailleurs le 9 août
(« les actions de l'objectif portent son unité, sans quoi rien ne monterait »).

**Cause, en une ligne.** `Onboarding.tsx` reconstruit ses modèles ainsi :

```ts
const STARTERS = STARTER_IDS.map((id) => {
  const t = GOAL_TEMPLATES.find((g) => g.id === id) as GoalTemplate;
  return { label: STARTER_LABELS[id], emoji: t.emoji, title: t.title, tiers: t.tiers };
  //                                    ↑ `t.actions` est jeté ici
});
```

Puis `onFinish(input, tiers)` appelle `createGoal(input, tiers)` sans troisième
argument, et `createGoal` retombe sur `DEFAULT_ACTIONS`. Les bonnes actions
existent dans le modèle, elles sont simplement perdues en route. `GoalPicker`,
lui, transmet le modèle entier — d'où l'écart entre les deux colonnes.

Correctif : porter `actions` jusqu'à `createGoal`. C'est une heure, et ça
change la première heure d'usage de chaque nouvel utilisateur.

### G. Le discours des trois écrans précède la moitié du produit

Une fois le bug ci-dessus corrigé, la remarque de fond reste. Les trois écrans
datent d'un Zénith où un palier était une case à cocher. Ils ne mentionnent
nulle part :

- **la nature des paliers** — « Ces paliers se comptent en *meilleure séance* /
  *cumul* / *compte* / *mesure* », le contrôle qui est aujourd'hui en tête de
  chaque carte d'objectif et qui décide de tout le comportement ;
- **les actions quantifiées** — un appui enregistre « Sortie course · 6 km »,
  c'est ce qui fait monter le palier, et c'est le geste central de l'app ;
- **les gestes ponctuels**, ajoutés depuis ;
- **à quoi servent les PP.** L'écran 3 dit « rapporte des points » — écrit
  quand les points ne servaient à rien. Ils ont maintenant une destination
  précise (compte hebdomadaire, 200 PP = un gel) et le gel est cité à l'écran
  suivant sans qu'on dise jamais qu'on l'achète.

Et le choix des modèles a vieilli de la même façon : **trois modèles proposés
sur les trente-neuf** de `GOAL_TEMPLATES` (`semi`, `lecture`, `ecrans`), figés
en dur, alors que la bibliothèque couvre le sport, la santé, les arrêts, les
écrans, l'esprit, l'argent et l'apprentissage — et que `GoalPicker` sait déjà
la parcourir par catégorie.

Ce qui reste vrai malgré tout, et qu'il faut garder : la forme. Trois écrans
courts qui se terminent par **un objet créé** plutôt que par un « J'ai
compris ». C'est le fond qu'il faut remettre à jour, pas la structure.

### E. La promesse publique et le premier écran ne coïncident pas

La page d'accueil publique vend Zénith (« Ce que Zénith ne fera jamais », « Les
grands objectifs se gagnent une étape à la fois »). On s'inscrit pour ça, et on
atterrit sur « Tes modules · Zénith · Astra ».

Je ne le traite pas ici. C'est le chantier §4 de CLAUDE.md — le renommage des
surfaces publiques — volontairement reporté, et il est plus gros que
l'onboarding. Le noter suffit : tant qu'il n'est pas fait, le chantier 1
ci-dessous doit assumer d'être le premier endroit où le mot « Atlas » prend un
sens.

---

## 3. Ce que je ne ferais pas

~~**Réécrire les trois écrans de Zénith.**~~ **Retiré — j'avais tort.** Voir
§2.G : le fond des trois écrans précède les paliers comptables, les actions
quantifiées, les gestes ponctuels et la destination des PP. C'est le texte
qu'il faut reprendre. Ce qu'il faut **garder**, c'est la forme : trois écrans
courts qui se terminent par un objet créé, jamais par « J'ai compris ».

**Une visite guidée à bulles** (coachmarks « clique ici », « puis là »). Le
réflexe classique, et le mauvais outil ici : le hub est déjà lisible, et chaque
bulle devient une dette qui casse à la prochaine retouche d'interface. Zénith a
choisi de faire créer un objet plutôt que de désigner des boutons ; c'est
mieux, il faut tenir cette ligne.

**Une barre « profil complété à 40 % ».** Ça marcherait — et ça abîmerait la
seule monnaie du produit. Zénith a déjà un système de progression qui veut dire
quelque chose (les rangs). En ajouter un second, faux, qui récompense le fait
d'avoir rempli des champs, dévalue le premier.

**Demander qui est l'utilisateur avant de le laisser entrer** (objectif
principal, fréquence, motivation). Chaque question est une occasion de partir.
Les trois modèles font déjà le travail de segmentation, en un clic et sans
formulaire.

---

## 4. Ce que je ferais, dans l'ordre

### 0. Transmettre les actions du modèle — ~1 h, et ça passe devant tout

`Onboarding.tsx` : garder `t.actions` dans `STARTERS`, et le passer en
troisième argument de `createGoal`. Une vérification e2e qui termine
l'accompagnement et lit les actions obtenues (« Sortie course », pas « Un vrai
effort ») empêchera la régression — c'est exactement le genre d'écart que
personne ne voit à la relecture.

### 1. Une phrase par module sur l'écran de choix — ~1 h

`AtlasModule` déclare déjà `{ id, label, emoji }`. Ajouter un `tagline`
obligatoire, et l'afficher sous le nom :

- **Zénith** — « Tes objectifs, découpés en paliers, chacun valant un rang. »
- **Astra** — « Où part ton argent, mois par mois, et ce que tu mets de côté. »

Le socle reste ignorant du contenu : il affiche un champ que le module déclare,
exactement comme `label` et `emoji`. Un test de convention (`conventions.test.ts`
en a déjà) peut exiger que tout module en fournisse un.

C'est une heure de travail sur l'écran que traversent 100 % des utilisateurs.
Rien d'autre dans cette liste n'a ce rapport.

### 2. Marqueur par module — ~2 h

Préalable au 3. Voir §2.D.

### 3. Un accompagnement Astra — ~½ j

Même forme que Zénith, parce qu'elle est bonne, et **surtout la même fin** :

1. *À quoi sert un budget ici* — ranger ce qui sort, voir le mois, mettre de
   côté.
2. *Les catégories* — la nature (fixe, variable, revenu, transfert) est ce qui
   rend le camembert lisible.
3. **Écran final : « Charge tes catégories de départ »** — le geste qui existe
   déjà, remonté à sa place.

Et, indépendamment de l'accompagnement : mettre « Charger les catégories de
départ » sur l'écran vide d'*Aperçu*, là où on arrive, pas seulement sur
*Catégories*.

### 3 bis. Reprendre le fond des trois écrans de Zénith — ~½ j

Voir §2.G. Même structure, contenu remis à niveau : la nature des paliers, les
actions quantifiées, et ce que les PP achètent. Et ouvrir le choix des modèles
au-delà des trois codés en dur — la bibliothèque en compte trente-neuf et
`GoalPicker` sait déjà les présenter par catégorie.

### 4. « Revoir l'accompagnement » dans les réglages — ~1 h

Une entrée par module, dans la section du module concerné
(`ZenithSettingsSection` existe déjà, Astra en aura une). Répare la porte à
sens unique du §2.C sans toucher aux conditions de déclenchement.

### 5. Aligner la page publique — hors périmètre

Voir §2.E et CLAUDE.md §4.

---

## 5. Le point de séquencement

L'étude V1 disait de garder l'onboarding pour la fin, et « plus tard que tu ne
le penses » : idéalement une fois le hub visible avec deux modules, pour que le
parcours soit « voici Atlas, et voilà ce qu'il y a dedans » plutôt que « voici
Zénith ».

Cette condition est remplie depuis Astra. Le moment est donc le bon — et c'est
aussi ce qui explique pourquoi le chantier a changé de nature : ce n'était pas
un accompagnement de Zénith à refaire, c'est un accompagnement d'Atlas à
écrire.
