import type {
  BudgetCategory,
  BudgetCategoryInput,
  BudgetEntry,
  BudgetEntryInput,
  BudgetEnvelope,
  BudgetEnvelopeInput,
  BudgetEnvelopeMove,
  BudgetEnvelopeMoveInput,
  BudgetRule,
  BudgetRuleInput,
} from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la
 * forme : il se contente d'assembler les sections que les modules lui
 * donnent (voir `core/data/backup.ts`).
 */
export interface BudgetBackup {
  categories: BudgetCategory[];
  entries: BudgetEntry[];
  rules: BudgetRule[];
  envelopes: BudgetEnvelope[];
  envelopeMoves: BudgetEnvelopeMove[];
}

/** Contrat de stockage du module budget (Astra). */
export interface BudgetStore {
  listCategories(): Promise<BudgetCategory[]>;
  createCategory(input: BudgetCategoryInput): Promise<BudgetCategory>;
  updateCategory(id: string, patch: Partial<BudgetCategoryInput>): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  listEntries(): Promise<BudgetEntry[]>;
  createEntry(input: BudgetEntryInput): Promise<BudgetEntry>;
  updateEntry(id: string, patch: Partial<BudgetEntryInput>): Promise<void>;
  deleteEntry(id: string): Promise<void>;

  listRules(): Promise<BudgetRule[]>;
  createRule(input: BudgetRuleInput): Promise<BudgetRule>;
  updateRule(id: string, patch: Partial<BudgetRuleInput>): Promise<void>;
  deleteRule(id: string): Promise<void>;

  /** Les enveloppes d'épargne (docs/etude-astra-epargne.md). */
  listEnvelopes(): Promise<BudgetEnvelope[]>;
  createEnvelope(input: BudgetEnvelopeInput): Promise<BudgetEnvelope>;
  updateEnvelope(id: string, patch: Partial<BudgetEnvelopeInput>): Promise<void>;
  /** Supprimer une enveloppe supprime ses mouvements : ses fonds retournent au non-affecté (§7 Q5). */
  deleteEnvelope(id: string): Promise<void>;

  /** Le journal des affectations/retraits — la somme donne le solde d'une enveloppe (§4.3). */
  listEnvelopeMoves(): Promise<BudgetEnvelopeMove[]>;
  createEnvelopeMove(input: BudgetEnvelopeMoveInput): Promise<BudgetEnvelopeMove>;
  deleteEnvelopeMove(id: string): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<BudgetBackup>;
  importData(data: BudgetBackup): Promise<void>;
}
