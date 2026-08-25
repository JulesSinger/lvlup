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

/** Origine d'une écriture : importée du relevé, ou saisie à la main. */
export const BUDGET_ENTRY_SOURCES = ['import', 'manuelle'] as const;
export type BudgetEntrySource = (typeof BUDGET_ENTRY_SOURCES)[number];

export interface BudgetCategory {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind: BudgetCategoryKind;
  /** Position d'affichage, 0 = première */
  position: number;
}

export interface BudgetCategoryInput {
  name: string;
  emoji?: string;
  color?: string;
  kind?: BudgetCategoryKind;
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
  createdAt: string;
}

export interface BudgetEnvelopeMoveInput {
  envelopeId: string;
  amountCents: number;
  day: string;
  note?: string;
}
