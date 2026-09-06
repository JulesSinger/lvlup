import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import { hasChildren, isValidParent, reindexPositions } from '../lib/categoryHierarchy';
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
import type { BudgetBackup, BudgetStore } from './budgetStore';

interface Snapshot extends BudgetBackup {}

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    // `parentId` normalisé ici, au seul point d'entrée : une catégorie
    // enregistrée avant les sous-catégories n'a pas ce champ du tout (`undefined`,
    // pas `null`), et le reste du module compare toujours à `null` pour dire
    // « catégorie normale ». Sans cette normalisation, toute catégorie plus
    // ancienne que cette fonctionnalité deviendrait invisible des groupes.
    categories: (Array.isArray(raw.budgetCategories) ? (raw.budgetCategories as BudgetCategory[]) : []).map(
      (c) => ({ ...c, parentId: c.parentId ?? null }),
    ),
    entries: Array.isArray(raw.budgetEntries) ? (raw.budgetEntries as BudgetEntry[]) : [],
    rules: Array.isArray(raw.budgetRules) ? (raw.budgetRules as BudgetRule[]) : [],
    envelopes: Array.isArray(raw.budgetEnvelopes) ? (raw.budgetEnvelopes as BudgetEnvelope[]) : [],
    envelopeMoves: Array.isArray(raw.budgetEnvelopeMoves)
      ? (raw.budgetEnvelopeMoves as BudgetEnvelopeMove[])
      : [],
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(snapshot: Snapshot) {
  writeRaw({
    ...readRaw(),
    budgetCategories: snapshot.categories,
    budgetEntries: snapshot.entries,
    budgetRules: snapshot.rules,
    budgetEnvelopes: snapshot.envelopes,
    budgetEnvelopeMoves: snapshot.envelopeMoves,
  });
}

/** Budget (Astra) stocké dans le navigateur, sans compte ni serveur. */
export class LocalBudget implements BudgetStore {
  async listCategories(): Promise<BudgetCategory[]> {
    return read().categories.slice().sort((a, b) => a.position - b.position);
  }

  async createCategory(input: BudgetCategoryInput): Promise<BudgetCategory> {
    const snapshot = read();
    const parentId = input.parentId ?? null;
    if (parentId !== null && !isValidParent(snapshot.categories, parentId)) {
      throw new Error('Une sous-catégorie ne peut pas elle-même être parente.');
    }
    const category: BudgetCategory = {
      id: newId(),
      name: input.name,
      emoji: input.emoji ?? '💶',
      color: input.color ?? '#7c8cf8',
      // Une sous-catégorie hérite toujours la nature de son parent — jamais
      // un choix libre de l'interface, voir la note sur `BudgetCategory`.
      kind: parentId
        ? (snapshot.categories.find((c) => c.id === parentId)?.kind ?? 'variable')
        : (input.kind ?? 'variable'),
      position: snapshot.categories.filter((c) => c.parentId === parentId).length,
      parentId,
    };
    snapshot.categories.push(category);
    write(snapshot);
    return category;
  }

  async updateCategory(id: string, patch: Partial<BudgetCategoryInput>) {
    const snapshot = read();
    const category = snapshot.categories.find((c) => c.id === id);
    if (!category) return;
    if (patch.parentId !== undefined && patch.parentId !== null) {
      if (!isValidParent(snapshot.categories, patch.parentId)) {
        throw new Error('Une sous-catégorie ne peut pas elle-même être parente.');
      }
      if (hasChildren(snapshot.categories, id)) {
        throw new Error('Une catégorie qui a des sous-catégories ne peut pas en devenir une.');
      }
    }
    Object.assign(category, patch);
    // La nature d'une sous-catégorie n'est jamais éditée directement (voir
    // CategoryEditor) ; mais si celle du parent change, ses enfants suivent —
    // sans quoi une sous-catégorie promue plus tard porterait une nature
    // devenue fausse depuis longtemps.
    if (patch.kind !== undefined && category.parentId === null) {
      for (const child of snapshot.categories) {
        if (child.parentId === id) child.kind = patch.kind;
      }
    }
    write(snapshot);
  }

  async deleteCategory(id: string) {
    const snapshot = read();
    // Une sous-catégorie n'est supprimée avec son parent nulle part dans ce
    // module : supprimer une catégorie qui en a la promeut en catégorie
    // normale plutôt que de l'emporter avec elle — même principe que « à
    // classer » pour les écritures, appliqué un niveau plus haut.
    for (const child of snapshot.categories) {
      if (child.parentId === id) child.parentId = null;
    }
    snapshot.categories = snapshot.categories.filter((c) => c.id !== id);
    reindexPositions(snapshot.categories);
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

  async listEnvelopes(): Promise<BudgetEnvelope[]> {
    return read().envelopes.slice().sort((a, b) => a.position - b.position);
  }

  async createEnvelope(input: BudgetEnvelopeInput): Promise<BudgetEnvelope> {
    const snapshot = read();
    const envelope: BudgetEnvelope = {
      id: newId(),
      name: input.name,
      emoji: input.emoji ?? '💶',
      color: input.color ?? '#7c8cf8',
      position: snapshot.envelopes.length,
    };
    snapshot.envelopes.push(envelope);
    write(snapshot);
    return envelope;
  }

  async updateEnvelope(id: string, patch: Partial<BudgetEnvelopeInput>) {
    const snapshot = read();
    const envelope = snapshot.envelopes.find((e) => e.id === id);
    if (!envelope) return;
    Object.assign(envelope, patch);
    write(snapshot);
  }

  async deleteEnvelope(id: string) {
    const snapshot = read();
    snapshot.envelopes = snapshot.envelopes.filter((e) => e.id !== id);
    // Supprimer une enveloppe supprime ses mouvements : ses fonds
    // retournent mécaniquement au non-affecté (docs/etude-astra-epargne.md
    // §7 Q5), sans mouvement compensatoire à écrire — même principe que la
    // contrainte `on delete cascade` côté Supabase.
    snapshot.envelopeMoves = snapshot.envelopeMoves.filter((m) => m.envelopeId !== id);
    write(snapshot);
  }

  async listEnvelopeMoves(): Promise<BudgetEnvelopeMove[]> {
    return read()
      .envelopeMoves.slice()
      .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  }

  async createEnvelopeMove(input: BudgetEnvelopeMoveInput): Promise<BudgetEnvelopeMove> {
    const snapshot = read();
    const move: BudgetEnvelopeMove = {
      id: newId(),
      envelopeId: input.envelopeId,
      // Entier signé : jamais de flottant, comme partout dans Astra.
      amountCents: Math.round(input.amountCents),
      day: input.day,
      note: input.note ?? '',
      createdAt: new Date().toISOString(),
    };
    snapshot.envelopeMoves.push(move);
    write(snapshot);
    return move;
  }

  async deleteEnvelopeMove(id: string) {
    const snapshot = read();
    snapshot.envelopeMoves = snapshot.envelopeMoves.filter((m) => m.id !== id);
    write(snapshot);
  }

  async exportData(): Promise<BudgetBackup> {
    const { categories, entries, rules, envelopes, envelopeMoves } = read();
    return {
      categories: categories.slice(),
      entries: entries.slice(),
      rules: rules.slice(),
      envelopes: envelopes.slice(),
      envelopeMoves: envelopeMoves.slice(),
    };
  }

  async importData(data: BudgetBackup) {
    write({
      categories: data.categories ?? [],
      entries: data.entries ?? [],
      rules: data.rules ?? [],
      envelopes: data.envelopes ?? [],
      envelopeMoves: data.envelopeMoves ?? [],
    });
  }
}
