import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import type {
  BudgetCategory,
  BudgetCategoryInput,
  BudgetEntry,
  BudgetEntryInput,
  BudgetRule,
  BudgetRuleInput,
} from '../lib/types';
import type { BudgetBackup, BudgetStore } from './budgetStore';

interface Snapshot extends BudgetBackup {}

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    categories: Array.isArray(raw.budgetCategories) ? (raw.budgetCategories as BudgetCategory[]) : [],
    entries: Array.isArray(raw.budgetEntries) ? (raw.budgetEntries as BudgetEntry[]) : [],
    rules: Array.isArray(raw.budgetRules) ? (raw.budgetRules as BudgetRule[]) : [],
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(snapshot: Snapshot) {
  writeRaw({
    ...readRaw(),
    budgetCategories: snapshot.categories,
    budgetEntries: snapshot.entries,
    budgetRules: snapshot.rules,
  });
}

/** Budget (Astra) stocké dans le navigateur, sans compte ni serveur. */
export class LocalBudget implements BudgetStore {
  async listCategories(): Promise<BudgetCategory[]> {
    return read().categories.slice().sort((a, b) => a.position - b.position);
  }

  async createCategory(input: BudgetCategoryInput): Promise<BudgetCategory> {
    const snapshot = read();
    const category: BudgetCategory = {
      id: newId(),
      name: input.name,
      emoji: input.emoji ?? '💶',
      color: input.color ?? '#7c8cf8',
      kind: input.kind ?? 'variable',
      position: snapshot.categories.length,
    };
    snapshot.categories.push(category);
    write(snapshot);
    return category;
  }

  async updateCategory(id: string, patch: Partial<BudgetCategoryInput>) {
    const snapshot = read();
    const category = snapshot.categories.find((c) => c.id === id);
    if (!category) return;
    Object.assign(category, patch);
    write(snapshot);
  }

  async deleteCategory(id: string) {
    const snapshot = read();
    snapshot.categories = snapshot.categories.filter((c) => c.id !== id);
    snapshot.categories.forEach((c, index) => (c.position = index));
    // Une écriture pointant sur la catégorie supprimée redevient « à
    // classer » plutôt que de référencer une catégorie fantôme.
    snapshot.entries = snapshot.entries.map((e) =>
      e.categoryId === id ? { ...e, categoryId: null } : e,
    );
    snapshot.rules = snapshot.rules.filter((r) => r.categoryId !== id);
    write(snapshot);
  }

  async listEntries(): Promise<BudgetEntry[]> {
    return read()
      .entries.slice()
      .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  }

  async createEntry(input: BudgetEntryInput): Promise<BudgetEntry> {
    const snapshot = read();
    const entry: BudgetEntry = {
      id: newId(),
      day: input.day,
      label: input.label,
      // Entier signé : jamais de flottant, voir docs/etude-astra.md §2.
      amountCents: Math.round(input.amountCents),
      categoryId: input.categoryId ?? null,
      source: input.source ?? 'manuelle',
      importKey: input.importKey ?? null,
      note: input.note ?? '',
      createdAt: new Date().toISOString(),
    };
    snapshot.entries.push(entry);
    write(snapshot);
    return entry;
  }

  async updateEntry(id: string, patch: Partial<BudgetEntryInput>) {
    const snapshot = read();
    const entry = snapshot.entries.find((e) => e.id === id);
    if (!entry) return;
    if (patch.day !== undefined) entry.day = patch.day;
    if (patch.label !== undefined) entry.label = patch.label;
    if (patch.amountCents !== undefined) entry.amountCents = Math.round(patch.amountCents);
    if (patch.categoryId !== undefined) entry.categoryId = patch.categoryId;
    if (patch.source !== undefined) entry.source = patch.source;
    if (patch.importKey !== undefined) entry.importKey = patch.importKey;
    if (patch.note !== undefined) entry.note = patch.note;
    write(snapshot);
  }

  async deleteEntry(id: string) {
    const snapshot = read();
    snapshot.entries = snapshot.entries.filter((e) => e.id !== id);
    write(snapshot);
  }

  async listRules(): Promise<BudgetRule[]> {
    return read().rules.slice().sort((a, b) => b.priority - a.priority);
  }

  async createRule(input: BudgetRuleInput): Promise<BudgetRule> {
    const snapshot = read();
    const rule: BudgetRule = {
      id: newId(),
      pattern: input.pattern,
      categoryId: input.categoryId,
      priority: input.priority ?? 0,
    };
    snapshot.rules.push(rule);
    write(snapshot);
    return rule;
  }

  async updateRule(id: string, patch: Partial<BudgetRuleInput>) {
    const snapshot = read();
    const rule = snapshot.rules.find((r) => r.id === id);
    if (!rule) return;
    Object.assign(rule, patch);
    write(snapshot);
  }

  async deleteRule(id: string) {
    const snapshot = read();
    snapshot.rules = snapshot.rules.filter((r) => r.id !== id);
    write(snapshot);
  }

  async exportData(): Promise<BudgetBackup> {
    const { categories, entries, rules } = read();
    return { categories: categories.slice(), entries: entries.slice(), rules: rules.slice() };
  }

  async importData(data: BudgetBackup) {
    write({
      categories: data.categories ?? [],
      entries: data.entries ?? [],
      rules: data.rules ?? [],
    });
  }
}
