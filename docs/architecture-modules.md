# Atlas — passer d'une app à un hub multi-modules

*Août 2026. Document d'architecture : où l'on veut aller, pourquoi, et dans quel ordre.
À lire avant tout travail structurel. Les règles qui en découlent sont résumées dans
`CLAUDE.md`.*

**Vocabulaire.** **Atlas** est le hub — l'application entière. **Zénith** est le nom affiché de
son premier module, le suivi d'objectifs par paliers. Le dépôt emploie encore « Zénith » au
sens de l'application entière dans son code et ses documents antérieurs : c'est le sens
historique, pas une erreur à corriger partout (voir `CLAUDE.md`, §4).

---

## 1. Le problème

Le suivi d'objectifs fonctionne, et bien. Mais il a été construit pour **un** domaine, et la
structure le montre partout :

| Fichier | Taille | Ce qu'il contient |
|---|---|---|
| `styles.css` | ~86 Ko | tout le style de l'application, un seul fichier |
| `App.tsx` | ~40 Ko | coquille, routage, célébrations, calcul des trophées |
| `Hub.tsx` | ~30 Ko | l'écran principal du domaine objectifs |
| `supabaseStore.ts` | ~25 Ko | l'accès aux données de tous les domaines |
| `components/` | 22 fichiers | à plat, sans séparation par domaine |

Ajouter un module budget dans cette structure produit trois effets, tous mauvais :

**a) Les fichiers partagés deviennent des points de collision.** Un module budget ajoute son
style dans `styles.css`, ses écrans dans `components/`, son routage dans `App.tsx`. Toute
conversation travaillant sur *n'importe quel* module touche donc les mêmes trois fichiers.
Deux sessions successives qui se croisent, et l'une écrase l'autre.

**b) L'interface `Store` explose.** C'est le point le plus structurant. Elle compte
aujourd'hui une quarantaine de méthodes qui mélangent deux natures très différentes :

- des méthodes **de socle**, valables pour toute l'application : authentification, réglages,
  appareils push, export/import ;
- des méthodes **du domaine objectifs** : `listGoals`, `createTier`, `addCheckin`,
  `unlockAchievements`…

Un module budget ajouterait sa quinzaine de méthodes au même contrat — et il faudrait les
implémenter **deux fois**, dans `LocalStore` et dans `SupabaseStore`. Au troisième module, ces
deux fichiers deviennent illisibles, et le contrat unique qui faisait la force du projet
devient ce qui le paralyse.

**c) La sauvegarde devient fausse silencieusement.** `exportAll` renvoie aujourd'hui un objet
`Backup` aux champs fixes. Un module dont les données n'y figurent pas est un module perdu le
jour d'une restauration — sans le moindre message d'erreur.

**À retenir : ce n'est pas la modularité qui coûte cher, c'est de l'ajouter trop tard.**
Découper maintenant représente une séance de travail. Découper après trois modules est un
chantier, avec un risque de régression sur du code qui marche.

---

## 2. La cible

```
src/
  core/                     ← le socle, commun à tous les modules
    components/             AuthScreen, Landing, PasswordRecovery, SettingsPanel,
                            ProfileHeader, ReminderSettings, navigation
    data/
      coreStore.ts          contrat du socle : auth, réglages, push, sauvegarde
      localCore.ts          implémentation navigateur
      supabaseCore.ts       implémentation Supabase
      outbox.ts             file d'attente hors-ligne (partagée)
      sync.ts               vidage de la file
      index.ts              choisit l'implémentation selon les variables d'env
    lib/                    push, son, confetti, utilitaires de date
    styles/
      base.css              variables, reset, typographie, composants communs

  modules/
    objectifs/
      module.ts             déclaration du module (voir §3)
      components/           Hub, GoalCard, GoalEditor, Ceremony, Heatmap, Timeline…
      data/
        goalsStore.ts       contrat du domaine
        localGoals.ts
        supabaseGoals.ts
      lib/                  ranks, progress, streak, counters, templates… + tests
      styles.css            styles préfixés `.goal-…`, `.tier-…`

    budget/
      module.ts
      components/
      data/
        budgetStore.ts
        localBudget.ts
        supabaseBudget.ts
      lib/
      styles.css            styles préfixés `.budget-…`

    index.ts                registre : la liste des modules actifs

  App.tsx                   coquille mince : authentification, navigation entre modules
  main.tsx
```

**Le principe :** un module est un dossier autonome. Il possède ses écrans, sa logique, ses
données, ses tests et son style. Il ne connaît pas les autres modules. Il ne dépend que de
`core/`.

Conséquence directe sur ta question de départ : **deux conversations qui travaillent sur deux
modules différents ne touchent plus aux mêmes fichiers.** Le risque de collision retombe aux
seuls points de contact réels — le registre et les migrations —, qui sont petits, rares, et
faciles à relire.

---

## 3. Le registre de modules

Un module se déclare, il ne se câble pas à la main dans `App.tsx` :

```ts
// src/modules/objectifs/module.ts
export const objectifsModule: AtlasModule = {
  id: 'objectifs',            // technique : dossier, préfixes SQL et CSS
  label: 'Zénith',            // affiché : le seul endroit où vit la marque
  emoji: '▲',
  Screen: ZenithScreen,       // composant racine du module
  store: goalsStore,          // son accès aux données
};

// src/modules/budget/module.ts
export const budgetModule: AtlasModule = {
  id: 'budget',
  label: 'Astra',
  emoji: '💶',
  Screen: BudgetScreen,
  store: budgetStore,
};
```

```ts
// src/modules/index.ts
export const MODULES = [objectifsModule, budgetModule];
```

**`id` et `label` ne bougent pas ensemble.** `id` est un identifiant : il nomme le dossier, le
préfixe des tables et celui des classes CSS, et ne change jamais pour une raison de
vocabulaire. `label` est la marque, et se change en une ligne. C'est ce qui permet de
rebaptiser un module sans écrire une migration de base de données.

La navigation basse, l'écran d'accueil et la sauvegarde se construisent **à partir de cette
liste**. Ajouter un module devient : créer un dossier, exporter une déclaration, ajouter une
ligne au registre. `App.tsx` n'est plus jamais modifié pour ça — et cesse donc d'être un point
de collision entre conversations.

---

## 4. Découper l'interface `Store`

C'est le cœur du chantier. Le contrat unique se scinde en un socle et un contrat par domaine.

```ts
// core/data/coreStore.ts
export interface CoreStore {
  readonly isRemote: boolean;
  // auth
  getUser(); onUserChange(); signUp(); signIn(); signOut();
  resetPassword(); updatePassword(); onPasswordRecovery();
  // réglages
  getSettings(); updateSettings();
  // notifications
  listPushDevices(); savePushDevice(); removePushDevice();
  sendTestPush(); pingPushFunction();
}

// modules/objectifs/data/goalsStore.ts
export interface GoalsStore {
  listGoals(); createGoal(); updateGoal(); deleteGoal();
  createTier(); updateTier(); deleteTier(); reorderTiers();
  listActions(); createAction(); updateAction(); deleteAction();
  listCheckins(); addCheckin(); addOneOff(); updateCheckin(); deleteCheckin();
  listAchievements(); unlockAchievements();
  // sauvegarde du module
  exportData(): Promise<GoalsBackup>;
  importData(data: GoalsBackup): Promise<void>;
}
```

**La propriété fondatrice est préservée :** aucun composant ne connaît Supabase ni
`localStorage`, chaque contrat garde ses deux implémentations, et l'app continue de tourner
sans compte en mode local.

**Ce que ça change pour la sauvegarde :** `exportAll` du socle parcourt le registre et
appelle l'`exportData` de chaque module. Une sauvegarde devient :

```json
{ "version": 2, "modules": { "objectifs": { … }, "budget": { … } } }
```

Le format v1 (champs à plat) reste lisible à l'import — les sauvegardes existantes de Jules ne
doivent pas devenir illisibles.

---

## 5. Le module budget (Astra) — modèle de données envisagé

Esquisse, à valider avant écriture. Toutes les tables sont préfixées, portent `user_id`, et
ont leurs quatre politiques RLS.

| Table | Rôle |
|---|---|
| `budget_categories` | catégories libres, définies par l'utilisateur : nom, emoji, couleur, type (fixe / variable / revenu), position |
| `budget_entries` | une ligne d'argent : date, libellé, montant (centimes), catégorie, compte, source (`manuelle` / `import`), note |
| `budget_plans` | le budget prévu par catégorie et par mois : `month` (`AAAA-MM`), `category_id`, `amount` |
| `budget_rules` | règles de catégorisation automatique : motif de libellé → catégorie, pour l'import de relevés |

**Montants en centimes, en entier.** Jamais de flottant pour de l'argent : `0.1 + 0.2` ne fait
pas `0.3`, et une somme de budget qui tombe à 0,01 € près donne l'impression d'un outil cassé.

**Le mois comme clé de tout.** `AAAA-MM`, cohérent avec le `day` en `AAAA-MM-JJ` déjà utilisé
par les check-ins.

**L'import de relevé bancaire est le point d'entrée principal.** Voir l'analyse comparative
des solutions de budget : la connexion directe à BoursoBank est fermée aux particuliers, et
l'export CSV depuis l'espace client est la seule voie gratuite et pérenne. `budget_rules`
existe pour que cet import demande de moins en moins de travail au fil des mois.

**Ce que le module budget hérite gratuitement du socle :** les comptes, le RLS, la synchro
multi-appareils, le mode hors-ligne, les notifications (« pense à importer ton relevé »),
l'export/import, l'hébergement. C'est précisément ce qui rend l'option « module dans Atlas »
sérieuse face à un tableur, là où une application construite de zéro ne l'était pas.

---

## 6. Ordre des travaux

Chaque étape est autonome, testable, et laisse le dépôt en état de marche. **Une étape par
session, un commit par étape.**

| # | Étape | Effort | Pourquoi maintenant |
|---|---|---|---|
| 1 | Découper `styles.css` : `core/styles/base.css` + un fichier par domaine | S | Le plus gros point de collision, et le moins risqué à traiter — aucun changement de logique |
| 2 | Créer `src/core/` et `src/modules/objectifs/`, déplacer l'existant | M | Purement mécanique, mais c'est ce qui rend les étapes suivantes possibles |
| 3 | Scinder `Store` en `CoreStore` + `GoalsStore` | M | Le vrai chantier. À faire avec un seul module, tant que c'est encore facile |
| 4 | Registre de modules + `App.tsx` réduit à une coquille | S | Retire le dernier fichier partagé du chemin critique |
| 5 | Sauvegarde versionnée par module (v2, compatible v1) | S | Doit exister **avant** le premier module, sinon les premières données budget ne sont pas sauvegardées |
| 6 | Module budget — modèle de données + saisie manuelle | M | Le socle est prêt ; on construit enfin |
| 7 | Import CSV + règles de catégorisation | M | Ce qui fait passer la saisie de corvée à routine |
| 8 | Visualisations : répartition, comparaison mensuelle, tendance | M | La demande d'origine |

Le renommage Zénith → Atlas des surfaces publiques (titre, manifeste, écrans d'accueil) se
greffe sur l'étape 4, quand `App.tsx` est réduit à une coquille. Il ne touche **aucune clé de
stockage** — la liste de ce qui doit rester intact est dans `CLAUDE.md`, §4.

Les étapes 1 à 5 ne produisent **aucune fonctionnalité visible**. C'est inconfortable, et
c'est le prix à payer une seule fois. Les faire après le module budget signifierait les faire
sur deux fois plus de code.

---

## 7. Ce qu'on ne fait pas

- **Pas de monorepo, pas de paquets séparés.** Un dossier par module suffit largement à cette
  échelle et n'ajoute aucun outillage à maintenir.
- **Pas de bibliothèque de graphiques lourde.** Le projet n'a aujourd'hui que React, Supabase
  et une police en dépendances — `PPChart` et `Heatmap` sont écrits à la main en SVG. Le
  module budget suit la même voie : c'est faisable, c'est cohérent avec l'esthétique
  existante, et ça évite d'alourdir le bundle.
- **Pas de réécriture.** Chaque étape déplace ou scinde du code qui fonctionne et reste
  couvert par les tests existants. Si une étape donne envie de « refaire proprement », c'est
  qu'elle est mal découpée.
- **Pas de gamification du budget dans un premier temps.** Les rangs et les PP ont un sens
  pour des objectifs qu'on choisit ; transposés à des dépenses subies, ils risquent surtout de
  culpabiliser. À réévaluer après quelques mois d'usage réel.
