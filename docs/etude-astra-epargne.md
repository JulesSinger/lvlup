# Astra — étude : les enveloppes d'épargne

*Étude de conception, écrite avant le code — même démarche que `docs/etude-astra.md` pour la
V1. Rien ci-dessous n'est encore construit. Les sept questions du §7 ont été tranchées avec
Jules le 25/08/2026 ; ce document est à jour de ces réponses — c'est la version qui sert de
base à l'étape 1.*

---

## 1. Le besoin, reformulé

Ce que tu as décrit avec l'exemple des 14 000 € : Astra sait aujourd'hui *que* tu mets de
l'argent de côté chaque mois (catégorie `Épargne`, exclue du camembert), mais ne garde nulle
part la **somme totale déjà mise de côté**, et encore moins sa répartition entre plusieurs
usages prévus (voiture, vacances, épargne de précaution…).

C'est une distinction connue en gestion de budget personnel, souvent appelée *budget par
enveloppes* (« envelope budgeting ») : on ne se contente pas de suivre ce qui rentre et sort,
on **donne un rôle à chaque euro déjà mis de côté**. « Sous-cagnotte » n'était pas un mauvais
réflexe — c'est littéralement le concept — et le terme retenu, à l'écran comme dans le code,
est **enveloppe**.

Deux choses très différentes sont donc en jeu, et il faut les garder distinctes :

1. **Combien j'ai mis de côté au total**, dans la vraie vie — un fait, dérivé de ton relevé
   bancaire (les virements vers ton épargne, moins ceux qui en reviennent).
2. **Comment je choisis de me répartir ce total sur le papier** — une décision purement
   personnelle, qui n'a pas de contrepartie bancaire (ton livret A ne sait pas qu'il contient
   « 1 000 € pour la voiture »). C'est une comptabilité *par-dessus* la vraie, comme
   l'enveloppe de tri postal ne change rien au contenu du colis.

Le premier point se lit dans `budget_entries`, qui existe déjà. Le second est entièrement
neuf.

---

## 2. Ce qui existe déjà, et ce qui manque

| Ce qu'Astra fait déjà | Ce qui manque pour ce chantier |
|---|---|
| Une catégorie `Épargne` (`kind = transfert`), exclue du camembert | Aucune **somme cumulée** nulle part — Astra ne regarde jamais qu'un mois à la fois (`MonthScreen`) |
| Le signe du montant distingue sortie/entrée | Rien ne distingue « virement vers l'épargne » de « tout autre virement interne » — les deux tombent dans `transfert` |
| Des catégories dynamiques, créables/renommables | Aucune notion d'enveloppe, ni de répartition d'un total entre plusieurs poches |
| Des écritures qui parlent d'un compte courant | Aucun mécanisme de « ceci n'est pas une opération bancaire, c'est une affectation sur le papier » |

Autrement dit : le squelette (catégories, signe, exclusion du camembert) est là et sert de
brique, mais la fonctionnalité elle-même — total cumulé + répartition dynamique — est à
construire entièrement.

---

## 3. Le point le plus important à trancher : d'où vient le total

Tu as écrit « imaginons que j'ai 14 000 € de côté » — la question est : **ce total, Astra le
calcule tout seul, ou tu le saisis toi-même ?**

### Option A — Total calculé automatiquement (recommandée)

Le total mis de côté = la somme, **depuis le début**, de toutes les écritures catégorisées
comme épargne (signe inversé : une sortie du compte courant vers l'épargne est un `-500 €`
côté compte courant, donc un `+500 €` côté épargne). C'est exactement le même principe que le
camembert du mois, mais sans limite de mois, et sur une seule catégorie plutôt que sur toutes.

**Avantage** : un seul geste (importer ou saisir le virement, comme aujourd'hui) suffit à
faire progresser le total. Aucune double saisie, aucun risque que le total affiché diverge de
la réalité bancaire.

**Condition** : il faut distinguer, parmi les catégories `transfert` actuelles, celles qui
représentent vraiment de l'épargne de celles qui n'en sont pas (`Virements internes` couvre
aussi, par exemple, un virement entre deux comptes courants qui n'a rien d'une mise de côté).
Je propose une nouvelle nature de catégorie, `epargne`, distincte de `transfert` — voir §4.

**Retirer de l'argent de l'épargne fonctionne déjà, dans ce modèle, sans rien ajouter.** Le
total est une somme signée : un virement *vers* l'épargne (sortie du compte courant) fait
monter le total, un virement *depuis* l'épargne (entrée sur le compte courant) le fait
mécaniquement descendre — les deux sont la même catégorie `epargne`, seul le signe change,
exactement comme le fait déjà `amountCents` partout ailleurs dans Astra (`docs/etude-astra.md`
§2). Le relevé d'exemple contient d'ailleurs déjà ce cas exact : la ligne
`VIR Virement depuis LIVRET A` (+150,00 €, catégorie `Mouvements internes créditeurs` dans le
relevé bancaire — à router vers `Épargne` plutôt que `Virements internes` une fois la
distinction faite, voir §5). Il n'y a donc rien de plus à construire pour ce point : c'est une
écriture comme une autre, positive, catégorisée `Épargne` — que ce soit un vrai retrait vers ta
poche courante, ou l'argent qui revient après avoir servi à une dépense liée à une enveloppe
(§6 bis, deuxième cas).

### Option B — Total saisi à la main

Tu indiques toi-même « j'ai 14 000 € au total », sans lien avec les écritures. Plus simple à
construire, mais le total se décale de la réalité dès le mois suivant si tu oublies de le
remettre à jour à la main — exactement le défaut qu'Astra a été conçu pour éviter ailleurs
(c'est toute la raison d'être de l'import CSV plutôt que d'une saisie manuelle généralisée,
voir `docs/etude-budget-solutions.md`).

**Je recommande l'option A.** Elle demande un peu plus de modélisation au départ, mais elle
tient la promesse de base d'Astra : une seule vérité, dérivée du relevé, jamais une deuxième
saisie à entretenir à la main.

---

## 4. Modèle de données proposé

### 4.1 Une nouvelle nature de catégorie : `epargne`

```
BUDGET_CATEGORY_KINDS = ['fixe', 'variable', 'revenu', 'transfert', 'epargne']
```

`epargne` se comporte comme `transfert` pour le camembert (exclue, pour la même raison :
mettre de l'argent de côté n'est pas une dépense) mais, en plus, **alimente le total** décrit
au §3. `Virements internes` reste en `transfert` — un virement entre deux comptes courants, ou
vers un compte joint, n'est pas une mise de côté. Ta catégorie `Épargne` existante passerait de
`transfert` à `epargne` (une catégorie, ça se reclasse aussi facilement qu'un renommage,
voir §8).

**Alternative envisagée et écartée** : ajouter un simple drapeau `compte_pour_epargne:
boolean` sur `transfert` plutôt qu'une nature à part. Rejetée parce que `kind` porte déjà des
décisions de ce genre (voir `docs/etude-astra.md` §2) et que le test qui compare la liste
TypeScript au `CHECK` de la base (`schema.test.ts`) existe justement pour ce genre
d'extension — un booléen de plus aurait le même effet mais moins de garde-fou.

### 4.2 `budget_envelopes` — les enveloppes elles-mêmes

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `user_id` | | |
| `name` | text | « Entretien voiture », « Vacances »… librement défini |
| `emoji`, `color` | text | Même logique que les catégories |
| `position` | integer | Ordre d'affichage |

Pas d'objectif chiffré dans cette V1 (décidé au §7 Q2) : seul le solde compte pour l'instant.
Un `target_cents` nullable viendra plus tard si l'usage en fait sentir le besoin — une colonne
additive de plus, comme le reste du modèle Astra (`docs/etude-astra.md` §1 : « le modèle de
données rend possible des vues différentes sans migration »).

### 4.3 `budget_envelope_moves` — la répartition, comme un journal

C'est le cœur du mécanisme, et la partie la moins évidente : plutôt que de stocker un solde
par enveloppe (`balance_cents` sur `budget_envelopes`) qui risquerait un jour de diverger de la
réalité (un bug, une mise à jour manquée), le solde d'une enveloppe est **calculé**, comme
partout ailleurs dans Astra — en sommant un journal de mouvements.

| Colonne | Type | Rôle |
|---|---|---|
| `id`, `user_id` | | |
| `envelope_id` | uuid | Quelle enveloppe |
| `amount_cents` | integer signé | `+` = fonds affectés à l'enveloppe, `-` = fonds repris |
| `day` | date | |
| `note` | text | Libre, ex. « vidange + pneus » |

**Le total non affecté ne se stocke pas, il se déduit** : `total épargné (§3) − somme de tous
les mouvements`. C'est ce qui garantit mécaniquement ta contrainte — *« la somme des enveloppes
doit être égale au total »* — sans avoir besoin de la vérifier : le non-affecté absorbe tout
écart par construction. Si tu affectes plus que ce qui est disponible, le non-affecté devient
négatif — affiché tel quel, en évidence, plutôt que bloqué (même philosophie que la part
« à classer » du camembert : montrer la vérité plutôt que la cacher).

**Pourquoi un journal plutôt qu'un solde stocké**, en une phrase : c'est le même choix qui a
déjà été fait pour le total du mois (recalculé depuis les écritures, jamais mis en cache) — un
solde stocké peut diverger, un solde recalculé ne peut pas mentir.

### 4.4 Le contrat de stockage

Un module apporte son contrat et ses deux implémentations (`CLAUDE.md` §3) : `BudgetStore`
gagnerait `listEnvelopes`, `createEnvelope`, `updateEnvelope`, `deleteEnvelope`,
`listEnvelopeMoves`, `createEnvelopeMove` — implémentées à la fois dans `LocalBudget` et
`SupabaseBudget`, comme le reste.

---

## 5. Ce que ça change ailleurs dans Astra

- **Le camembert du mois** (`lib/monthlyBreakdown.ts`) exclut aujourd'hui `kind = transfert` ;
  il faudra aussi exclure `kind = epargne`, pour la même raison.
- **Les catégories de départ** (`lib/starterCategories.ts`) : `Épargne` passe de `transfert` à
  `epargne`.
- **L'import CSV** (`lib/boursobankImport.ts`) : `BOURSOBANK_CATEGORY_MAP` route aujourd'hui
  `Mouvements internes débiteurs/créditeurs` vers `Virements internes`. Un jour, il faudra
  décider si certains libellés (par exemple ceux qui mentionnent un livret, comme
  `VIR Virement depuis LIVRET A` dans le relevé d'exemple) doivent plutôt suggérer `Épargne` —
  je ne le fais pas d'office : deviner sur un mot-clé serait le même risque que celui déjà
  écarté à l'étape 5 (confondre deux types de virement). Le mécanisme de règles créées à la
  volée (« créer une règle ») couvre déjà ce besoin une fois que tu as corrigé la ligne une
  fois.
- **La sauvegarde** (export/import JSON, `CLAUDE.md` §6) : les nouvelles tables doivent
  rejoindre `BudgetBackup` pour qu'une restauration ne perde pas les enveloppes.

---

## 6. Fonctionnalités envisagées, et sort qui leur a été donné

Tu as demandé une étude qui va au-delà de l'ébauche — voici ce qui a été proposé, et la
décision prise avec toi le 25/08/2026 (§7 en détaille les réponses).

**Objectif chiffré par enveloppe.** Proposé pour la V1, mais **écarté pour l'instant** (§7 Q2) :
seul le solde compte au départ, l'objectif viendra plus tard si l'usage en fait sentir le
besoin.

**Historique des mouvements par enveloppe.** Retenu — direct puisque c'est déjà un journal
(§4.3), juste une question d'écran. Voir le découpage au §8.

**Une petite courbe d'évolution du total épargné dans le temps.** Envisagée, pas retenue pour
cette V1 : un écran de plus, à revoir une fois le mécanisme de base validé à l'usage.

**Alerte quand le non-affecté est négatif.** Retenue par défaut (coût quasi nul, juste une
mise en forme du total déjà calculé) — intégrée à l'écran des enveloppes dès l'étape 2.

**Lier une dépense à une enveloppe** (la vidange qui viendrait piocher automatiquement dans
l'enveloppe « Entretien voiture »). Écarté une première fois (§7 Q1), puis reconsidéré — voir
§6 bis, qui répond à l'objection soulevée sur la cohérence avec le compte bancaire réel.

**Transfert direct d'une enveloppe à une autre.** Écarté (§7 Q5) : retirer puis réaffecter
suffit, et ça évite un type de mouvement supplémentaire à modéliser — `budget_envelope_moves`
ne porte donc qu'un seul geste (affecter/retirer), jamais un virement enveloppe-à-enveloppe en
une opération.

---

## 6 bis. Lier une dépense à une enveloppe, sans casser la cohérence bancaire

Objection soulevée après coup, et elle est juste : si dépenser dans une enveloppe devait
correspondre à un vrai retrait de l'épargne bancaire, il faudrait faire le virement réel à
chaque fois pour qu'Astra reste fidèle à la banque — un geste de plus à chaque vidange, ce qui
complique bien plus que ça n'aide.

**La bonne nouvelle : ce n'est pas nécessaire, et le modèle du §4 le permet déjà sans rien
changer.** La clé est de bien séparer deux choses qui se ressemblent mais ne sont pas pareilles :

- **Le total mis de côté** (§3) ne bouge que quand un vrai virement vers l'épargne est
  enregistré — c'est la seule chose qui doit rester fidèle à la banque, et rien dans ce qui
  suit n'y touche.
- **Le solde d'une enveloppe** est une étiquette posée sur une partie de ce total, purement
  déclarative — la déplacer d'une enveloppe vers le non-affecté ne fait pas sortir l'argent du
  total, elle dit juste « je ne réserve plus cette part pour cet usage ».

Concrètement : payer la vidange **reste une dépense normale**, saisie ou importée comme
aujourd'hui (catégorie « Entretien voiture » ou autre, payée depuis le compte courant — rien
de changé côté `budget_entries`, aucune migration supplémentaire). *En plus de ça*, si tu veux
que ce paiement se voie sur l'enveloppe, tu enregistres **un retrait sur l'enveloppe
« Voiture »**, du même montant — c'est le mécanisme déjà prévu au §4.3 (`budget_envelope_moves`,
un montant négatif), avec une note libre (« vidange + pneus, payée le 12/03 depuis le compte
courant »). Ce retrait renvoie 80 € au non-affecté ; il **ne change pas le total épargné**.

Ce que ça veut dire pour toi, dans les deux cas de figure réels :

- **Tu paies depuis ton compte courant, l'argent reste sur ton livret.** C'est le cas le plus
  courant. Tu enregistres juste le retrait sur l'enveloppe (un geste, deux secondes) — aucun
  virement réel à faire, aucune incohérence : l'argent est toujours bien là où la banque le
  voit, seule l'étiquette « réservé pour la voiture » disparaît.
- **Tu préfères vraiment rapatrier l'argent du livret vers le compte courant** pour payer.
  Alors tu fais le virement réel, tu l'importes ou le saisis comme n'importe quel virement
  `Épargne` (ça fait mécaniquement baisser le total, exactement comme aujourd'hui), et tu
  enregistres le retrait sur l'enveloppe en même temps pour que ce soit bien elle qui baisse.

Dans les deux cas, **aucune écriture (`budget_entries`) ne référence jamais une enveloppe** :
le lien est un geste manuel de deux clics (dépense d'un côté, retrait de l'autre), pas un
couplage automatique. C'est délibérément moins automatique qu'un vrai lien technique — et
c'est justement ce qui évite la complexité que tu craignais : rien n'oblige à faire correspondre
un virement réel à chaque dépense liée. Si un jour l'usage montre que refaire ce geste à la
main est pénible, on pourra reconsidérer un vrai lien (`envelope_id` sur l'écriture, qui crée le
retrait automatiquement) — mais ça n'est pas nécessaire pour profiter de la fonctionnalité dès
la V1, et ça ne demande aucun changement du modèle proposé au §4.

---

## 7. Décisions prises avec Jules (25/08/2026)

| # | Question | Décision |
|---|---|---|
| 1 | Le mot à l'écran | **Enveloppe** |
| 2 | Lier une dépense à une enveloppe | **Oui, mais sans coupler `budget_entries`** — un retrait manuel sur l'enveloppe (§6 bis), pas un lien technique automatique. Aucun changement au modèle du §4 |
| 3 | Objectif chiffré par enveloppe en V1 | **Non**, juste le solde pour commencer |
| 4 | Périmètre du total | **Seulement la catégorie Épargne** (nature `epargne`, §4.1) — pas de `Virements internes` au cas par cas |
| 5 | Suppression d'une enveloppe non vide | Ses fonds **retournent au non-affecté**, comme une catégorie supprimée renvoie ses écritures vers « à classer » |
| 6 | Déplacer des fonds directement d'une enveloppe à une autre | **Non** — retirer puis réaffecter suffit |
| 7 | Données réelles déjà catégorisées `Épargne` dans Supabase | **Aucune** — la migration n'a pas de reclassement à faire, seulement à créer le nouveau modèle |

Ces réponses simplifient le modèle par rapport à l'ébauche initiale : ni `target_cents`, ni
type de mouvement « transfert », ni migration de données existantes. Le §4 et le §8 sont à
jour de ces choix.

---

## 8. Découpage retenu

| # | Étape | Ce qu'elle livre |
|---|---|---|
| 1 | Migration (nature `epargne`, tables `budget_envelopes` + `budget_envelope_moves`) + contrat de stockage, sans écran | Le module absorbe le nouveau modèle, `conventions.test.ts` toujours vert |
| 2 | Écran des enveloppes : créer, renommer, affecter/retirer des fonds, total et non-affecté (avec alerte si négatif) | On peut répartir les 14 000 € de ton exemple |
| 3 | Historique des mouvements par enveloppe | On voit comment on y est arrivé, pas juste où on en est |

Comme pour la V1, chaque étape reste un commit avec tests et vérifications au vert. L'objectif
chiffré et la courbe d'évolution restent des idées notées (§6), pas planifiées : elles
reviendront si l'usage en montre le besoin. Le lien dépense ↔ enveloppe (§6 bis), lui, est déjà
couvert par l'étape 2 — c'est un simple retrait avec une note, aucun écran ni table
supplémentaire.
