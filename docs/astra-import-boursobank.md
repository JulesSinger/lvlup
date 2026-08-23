# Astra — le format du relevé BoursoBank

*Établi sur un export réel (juillet 2026, 36 opérations). Complète `docs/etude-astra.md` §4.
À revérifier si BoursoBank change son export — mais ne rien deviner : réexporter et relire.*

---

## 1. Le format, mesuré et non supposé

| Caractéristique | Valeur | Conséquence |
|---|---|---|
| Encodage | UTF-8 **avec BOM** (`EF BB BF`) | ⚠ voir ci-dessous |
| Fins de ligne | LF seul | |
| Séparateur | `;` | |
| En-tête | présent, 12 colonnes | |
| Guillemets | seulement si le champ contient une espace | analyseur CSV standard requis |
| Dates | `AAAA-MM-JJ` | aucune ambiguïté jour/mois |
| Montants | virgule décimale, **espace ordinaire** (0x20) pour les milliers | `"-1 500,00"` |
| `accountbalance` | **point** décimal, sans séparateur | `683.65` |

**Le BOM est le premier piège.** Sans le retirer, le nom de la première colonne devient
`﻿dateOp` et la lecture de l'en-tête échoue — avec un message qui ne parle pas du BOM.

**Les deux conventions décimales dans le même fichier sont le second.** `amount` utilise la
virgule, `accountbalance` le point. On n'a pas besoin du solde, mais quiconque le lirait par
réflexe se tromperait.

**L'espace de milliers est une espace ordinaire, pas une insécable.** Vérifié octet par octet.
Ne pas se fier à cette différence, retirer toutes les espaces.

### Lire un montant sans jamais passer par un flottant

```
"-1 500,00"  →  retirer les espaces      →  "-1500,00"
             →  couper sur la virgule    →  "-1500" et "00"
             →  centimes = -(1500 × 100 + 0) = -150000
```

Le signe se lit sur la partie entière et s'applique au total. Passer par `parseFloat` puis
`× 100` réintroduit exactement l'erreur que les centimes entiers évitent.

---

## 2. Les colonnes, et ce qu'on en fait

| Colonne | Sort | Devient |
|---|---|---|
| `dateOp` | ✅ | `day` |
| `dateVal` | ❌ | identique à `dateOp` sur tout l'échantillon |
| `label` | ✅ | `label` — le libellé brut, **fait foi pour le dédoublonnage** |
| `suggestedLabel` | ✅ | nom affiché quand il existe (« Auchan » plutôt que `CARTE 28/07/26 DAC AUCHAN CARBU CB*8881`) |
| `category` | ✅ | indice de catégorisation |
| `categoryParent` | ✅ | **la vraie clé** — voir §3 |
| `amount` | ✅ | `amount_cents`, signé |
| `comment` | ❌ | vide partout |
| `accountNum`, `accountLabel` | ❌ | un seul compte |
| `accountbalance` | ❌ | solde après opération, reconstituable, et piège décimal |
| `mark` | ❌ | pointage manuel dans BoursoBank |

**Garder `label` brut et non `suggestedLabel` comme identité de la ligne.** Le libellé suggéré
est un confort d'affichage que BoursoBank peut changer sans prévenir ; s'en servir pour
l'empreinte ferait réapparaître d'anciennes opérations comme neuves après une mise à jour de
leur côté.

---

## 3. Le cadeau : BoursoBank catégorise déjà

L'export porte une catégorie et une catégorie parente. **Le premier import arrive donc
largement pré-classé**, ce qui change la nature de l'étape 5 : on ne part pas d'une page
blanche.

Les onze valeurs de `categoryParent` rencontrées, et leur destination :

| `categoryParent` BoursoBank | Catégorie Astra | `kind` |
|---|---|---|
| Vie quotidienne | Courses / Vêtements / Maison, selon `category` | `variable` |
| Loisirs et sorties | Restaurants & bars / Sorties & loisirs | `variable` |
| Auto & Moto | Transport | `variable` |
| Voyages & Transports | Voyages | `variable` |
| Santé | Santé | `variable` |
| Abonnements & téléphonie | Abonnements | `fixe` |
| **Mouvements internes débiteurs** | Virements internes | **`transfert`** |
| **Mouvements internes créditeurs** | Virements internes | **`transfert`** |
| Virements émis | Virements & remboursements | `variable` |
| Virements reçus | Salaire / Aides, selon le libellé | `revenu` |
| Non catégorisé | *(laisser vide)* | — |

**Les deux lignes en gras sont celles qui sauvent le camembert.** Dans ce seul relevé,
1 500 € partent vers un autre compte et 300 € en reviennent depuis un Livret A. Sans le `kind`
`transfert`, juillet afficherait 1 500 € de « dépenses » fantômes et le camembert serait
illisible.

**Attention à ne pas confondre les deux familles de virements.** `VIR INST AURELIEN LEROUSSEAU`
à −25 € est un vrai mouvement d'argent vers quelqu'un ; `VIR Virement depuis LIVRET A` à
+200 € est un déplacement entre tes propres poches. BoursoBank les distingue déjà par
`categoryParent` — il suffit de ne pas écraser cette distinction.

Le mapping est un **point de départ**, appliqué à l'import sous forme de règles
`budget_rules` modifiables. Il ne doit pas être figé dans le code : le jour où BoursoBank
renomme une catégorie, on veut corriger une ligne de données, pas recompiler.

---

## 4. Le dédoublonnage, validé par le fichier lui-même

Le relevé contient **deux lignes strictement identiques** :

```
2026-07-07 ; "CARTE 04/07/26 LES EUROCKEENNES CB*8881" ; -100,00
2026-07-07 ; "CARTE 04/07/26 LES EUROCKEENNES CB*8881" ; -100,00
```

Deux places de concert achetées séparément. Aucune colonne ne les distingue : ni identifiant,
ni heure, ni solde intermédiaire.

C'est la démonstration que l'empreinte **doit** inclure un rang d'occurrence :
`import_key = empreinte(jour | libellé | montant | n)`, où `n` est le rang de la ligne parmi
ses jumelles dans le fichier. Une empreinte sans rang aurait avalé la seconde place en
silence — et 100 € manquants dans un budget, on ne les retrouve jamais.

Avec le rang, réimporter le même relevé ne crée rien : l'unicité `(user_id, import_key)`
rejette les deux lignes déjà connues.

---

## 5. Ce que ce relevé apprend d'autre

**Les remboursements existent bel et bien.** `AVOIR 15/07/26 LES EUROCKEENNES` à **+66,72 €**
dans une catégorie de loisirs : un montant positif dans une catégorie de dépense. Le montant
signé le gère naturellement — la catégorie totalise 66,72 € de moins. C'est la justification
concrète du signe plutôt que d'un champ `type`.

De même `VIR SEPA HARMONIE MUTUELLE` +9,00 € et `C.P.A.M.` +15,48 € en Santé : des
remboursements de frais, qui doivent alléger la catégorie Santé et non gonfler les revenus.

**Le décalage de date est réel.** `CARTE 28/07/26 …` apparaît en `dateOp` du 30/07. Le libellé
porte la date d'achat, la ligne porte la date de comptabilisation. **On garde `dateOp`** : la
cohérence avec le relevé bancaire vaut mieux qu'une exactitude qu'on ne pourra jamais
recouper. Extraire la date du libellé serait un travail d'analyse fragile pour un gain nul.

**« Non catégorisé » est fréquent.** Cinq lignes sur trente-six, dont un abonnement mensuel
récurrent. Ce sont exactement celles que l'écran d'import doit remonter en tête, et pour
lesquelles créer une règle rapporte le plus.

---

## 6. Ce qu'il reste à vérifier plus tard

- **Un mois avec plusieurs comptes.** L'export ne contenait qu'un compte ; si un compte dédié
  aux charges fixes est ouvert, revérifier si `accountNum` se met à varier dans un même
  fichier.
- **Un montant à plus de six chiffres**, pour confirmer qu'un second séparateur de milliers se
  comporte comme le premier.
- **Un export à cheval sur deux années**, pour le tri.

Aucune de ces trois inconnues ne bloque l'écriture de l'importeur : elles ne changent que des
cas limites, et le format de base est établi.
