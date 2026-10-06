/**
 * Types du module budget (Astra). Conception complète : docs/etude-astra.md.
 */

/**
 * Nature d'une catégorie — elle porte quatre décisions (docs/etude-astra.md
 * §2, docs/etude-astra-epargne.md §4.1) : `fixe` sépare ce qui tombe tous
 * les mois de ce sur quoi on peut agir ; `transfert` exclut la catégorie du
 * camembert, sans quoi mettre de l'argent de côté compterait comme une
 * dépense ; `revenu` distingue le salaire du reste ; `epargne` se comporte
 * comme `transfert` (exclue du camembert) mais alimente en plus le total
 * mis de côté que suivent les enveloppes (`BudgetEnvelope` ci-dessous) —
 * une distinction délibérée : `transfert` couvre aussi des mouvements qui
 * ne sont pas une mise de côté (un virement entre deux comptes courants),
 * qui ne doivent pas gonfler ce total.
 *
 * Déclarée en tableau et non en simple union : un test compare cette liste
 * au CHECK de la base (`schema.test.ts`) — la divergence s'est déjà produite
 * une fois sur `TIER_KINDS`, voir `modules/objectifs/lib/schema.test.ts`.
 */
export const BUDGET_CATEGORY_KINDS = ['fixe', 'variable', 'revenu', 'transfert', 'epargne'] as const;
export type BudgetCategoryKind = (typeof BUDGET_CATEGORY_KINDS)[number];

/**
 * Intitulé de groupe par nature — un seul endroit pour cette correspondance,
 * partagée par l'écran des catégories (regroupement visuel) et le
 * sélecteur de l'éditeur d'écriture (`<optgroup>`), pour qu'ils ne puissent
 * pas diverger.
 */
export const CATEGORY_KIND_LABELS: Record<BudgetCategoryKind, string> = {
  fixe: 'Fixes',
  variable: 'Variables',
  revenu: 'Revenus',
  transfert: 'Transferts',
  epargne: 'Épargne',
};

/** Origine d'une écriture : importée du relevé, ou saisie à la main. */
export const BUDGET_ENTRY_SOURCES = ['import', 'manuelle'] as const;
export type BudgetEntrySource = (typeof BUDGET_ENTRY_SOURCES)[number];

/**
 * Une catégorie peut avoir des sous-catégories (« Restaurants & bars » →
 * « Restaurants », « Bar »), sur **un seul niveau** : une sous-catégorie ne
 * peut jamais elle-même être parente. `parentId` porte cette relation ;
 * `null` = catégorie normale.
 *
 * `kind` reste posé sur chaque ligne, y compris une sous-catégorie — jamais
 * recalculé par une remontée vers le parent. Ce n'est pas un choix libre de
 * l'interface (une sous-catégorie hérite toujours la nature de son parent,
 * et n'a pas son propre sélecteur), mais un choix de stockage délibéré :
 * supprimer un parent **promeut** ses sous-catégories en catégories
 * normales (§ `deleteCategory`) plutôt que de les supprimer avec lui — rien
 * de saisi par l'utilisateur ne disparaît jamais silencieusement. Une
 * sous-catégorie promue doit donc déjà porter une nature valide, faute de
 * quoi elle se retrouverait orpheline de la seule information qui lui
 * manque pour continuer à fonctionner seule.
 */
export interface BudgetCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: BudgetCategoryKind;
  /** Position d'affichage, 0 = première — parmi ses sœurs (même parent, ou aucun). */
  position: number;
  /** Catégorie parente, ou `null`. Voir la note ci-dessus : un seul niveau de profondeur. */
  parentId: string | null;
}

export interface BudgetCategoryInput {
  name: string;
  emoji?: string;
  color?: string;
  kind?: BudgetCategoryKind;
  parentId?: string | null;
}

/**
 * Une opération : ligne du relevé importée, ou saisie ponctuelle.
 *
 * `amountCents` est un entier signé, jamais un flottant — 0,1 + 0,2 ne fait
 * pas 0,3 en virgule flottante, et un total qui tombe à un centime près
 * donne l'impression d'un outil cassé. Négatif = sortie, positif = entrée ;
 * c'est ce signe, plutôt qu'un champ `type`, qui gère naturellement un
 * remboursement (une entrée positive dans une catégorie de dépense).
 */
export interface BudgetEntry {
  id: string;
  /** Jour de l'opération, au format YYYY-MM-DD — le mois s'en déduit, pas de colonne dédiée. */
  day: string;
  /** Libellé brut, tel que la banque l'écrit. Fait foi pour le dédoublonnage. */
  label: string;
  amountCents: number;
  /** Null = pas encore catégorisé : apparaît sous « À classer », jamais masqué. */
  categoryId: string | null;
  source: BudgetEntrySource;
  /** Empreinte de dédoublonnage d'une ligne importée ; nulle en saisie manuelle. */
  importKey: string | null;
  note: string;
  createdAt: string;
}

export interface BudgetEntryInput {
  day: string;
  label: string;
  amountCents: number;
  categoryId?: string | null;
  source?: BudgetEntrySource;
  importKey?: string | null;
  note?: string;
}

/** Une règle de catégorisation automatique, appliquée à l'import. */
export interface BudgetRule {
  id: string;
  /** Fragment cherché dans le libellé brut, insensible à la casse. */
  pattern: string;
  categoryId: string;
  /** La plus haute gagne quand deux règles matchent la même ligne. */
  priority: number;
}

export interface BudgetRuleInput {
  pattern: string;
  categoryId: string;
  priority?: number;
}

/**
 * Une enveloppe d'épargne (docs/etude-astra-epargne.md) : une étiquette
 * posée sur une partie du total mis de côté (« 1 000 € pour la voiture »).
 * Son solde n'est jamais stocké ici — il se calcule en sommant ses
 * `BudgetEnvelopeMove` (§4.3), pour ne jamais pouvoir diverger.
 */
export interface BudgetEnvelope {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** Position d'affichage, 0 = première */
  position: number;
}

export interface BudgetEnvelopeInput {
  name: string;
  emoji?: string;
  color?: string;
}

/**
 * Un mouvement sur une enveloppe : affectation (`amountCents` positif) ou
 * retrait (négatif). Purement déclaratif — aucun lien avec `budget_entries`
 * ni avec une vraie opération bancaire (docs/etude-astra-epargne.md §6 bis) :
 * déplacer 80 € de l'enveloppe « Voiture » vers le non-affecté ne fait
 * jamais bouger le total mis de côté, qui ne dépend que des écritures
 * catégorisées `epargne`.
 */
export interface BudgetEnvelopeMove {
  id: string;
  envelopeId: string;
  amountCents: number;
  day: string;
  /** Libre — ex. « vidange + pneus, payée depuis le compte courant ». */
  note: string;
  /**
   * La dépense que ce retrait paie (depuis le 2026-10-07, §6 bis) : il la
   * suit — supprimer la dépense supprime le retrait. `null` : un mouvement
   * posé à la main.
   */
  entryId: string | null;
  createdAt: string;
}

export interface BudgetEnvelopeMoveInput {
  envelopeId: string;
  amountCents: number;
  day: string;
  note?: string;
  entryId?: string | null;
}

/**
 * Le rythme d'un abonnement, déclaré à la main ou repéré dans les relevés
 * (`lib/recurring.ts`). Pendant `as const` de `budget_subscriptions_frequency_check`.
 */
export const SUBSCRIPTION_FREQUENCIES = ['hebdomadaire', 'mensuel', 'trimestriel', 'annuel'] as const;
export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCIES)[number];

/** Combien de jours avant une échéance on peut être prévenu (`null` : jamais). */
export const SUBSCRIPTION_REMIND_DAYS = [3, 7, 15, 30] as const;
export type SubscriptionRemindDays = (typeof SUBSCRIPTION_REMIND_DAYS)[number];

export const SUBSCRIPTION_NAME_MAX = 80;

/**
 * Un abonnement déclaré à la main (2026-10-07) : ce que la détection ne voit
 * pas encore (tout neuf, annuel pas encore payé deux fois) ou ne verra
 * jamais (une autre carte, PayPal, des espèces). Une **prévision**, jamais
 * une écriture : ce sont les relevés qui restent la vérité du budget.
 */
export interface BudgetSubscription {
  id: string;
  name: string;
  /** Le montant habituel, en centimes, positif. */
  amountCents: number;
  frequency: SubscriptionFrequency;
  /** Une échéance connue ; les suivantes s'en déduisent au rythme. */
  nextDay: string;
  categoryId: string | null;
  /**
   * Un motif de libellé (« NETFLIX ») pour reconnaître ses paiements dans les
   * relevés : l'abonnement n'apparaît alors qu'une fois, « vu dans tes
   * relevés ». Vide : rien à rapprocher.
   */
  pattern: string;
  /** Prévenir tant de jours avant chaque échéance ; `null` : jamais. */
  remindDays: SubscriptionRemindDays | null;
  createdAt: string;
}

export interface BudgetSubscriptionInput {
  name: string;
  amountCents: number;
  frequency: SubscriptionFrequency;
  nextDay: string;
  categoryId?: string | null;
  pattern?: string;
  remindDays?: SubscriptionRemindDays | null;
}

/**
 * Une dépense récurrente repérée qu'on a écartée (« ce n'est pas un
 * abonnement ») : on retient sa clé (`labelKey`), elle ne revient plus.
 */
export interface IgnoredRecurring {
  key: string;
  label: string;
  createdAt: string;
}
